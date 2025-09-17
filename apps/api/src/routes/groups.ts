import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { ConflictError, TooManyRequestsError } from '../middleware/error';

const router = Router();

// Store last fetch groups time for rate limiting
let lastFetchGroups: number = 0;
const FETCH_GROUPS_COOLDOWN = 10000; // 10 seconds

// GET /api/groups
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const { search = '', limit = 25, offset = 0 } = req.query;

    // Build query
    let query = supabase
      .from('groups')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Apply search filter if provided
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,wa_group_id.ilike.%${search}%`);
    }

    const { data: groups, error, count } = await query;

    if (error) {
      console.error('Error fetching groups:', error);
      throw new Error('Failed to fetch groups');
    }

    res.json({
      items: groups || [],
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Groups endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch groups'
    });
  }
});

// POST /api/groups/:id/toggle
router.post('/groups/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { monitor } = req.body;

    // Validate input
    const toggleSchema = z.object({
      monitor: z.boolean()
    });
    
    const validation = toggleSchema.safeParse({ monitor });
    if (!validation.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid monitor value'
      });
    }

    // Check if group exists and get current monitor status
    const { data: currentGroup, error: fetchError } = await supabase
      .from('groups')
      .select('monitor')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching group:', fetchError);
      return res.status(404).json({
        error: 'not_found',
        message: 'Group not found'
      });
    }

    // Check if no change
    if (currentGroup.monitor === monitor) {
      throw new ConflictError('No change in monitor status');
    }

    // Update monitor status
    const { error: updateError } = await supabase
      .from('groups')
      .update({ monitor })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating group:', updateError);
      throw new Error('Failed to update group');
    }

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ConflictError) {
      throw error;
    }
    console.error('Toggle group endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to toggle group monitoring'
    });
  }
});

// POST /api/fetch-groups-now
router.post('/fetch-groups-now', async (req: Request, res: Response) => {
  try {
    // Rate limiting check
    const now = Date.now();
    if (now - lastFetchGroups < FETCH_GROUPS_COOLDOWN) {
      throw new TooManyRequestsError('Fetch groups too frequent. Please wait 10 seconds.');
    }

    // Set runtime flag for worker to discover groups
    const { error } = await supabase
      .from('runtime_flags')
      .upsert({
        key: 'fetch_groups_requested',
        value: { at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error setting fetch groups flag:', error);
      throw new Error('Failed to request group discovery');
    }

    lastFetchGroups = now;
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      throw error;
    }
    console.error('Fetch groups endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to trigger group discovery'
    });
  }
});

export default router;
