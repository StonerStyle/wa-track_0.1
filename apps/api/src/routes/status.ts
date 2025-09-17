import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// GET /api/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get WhatsApp session status
    const { data: waSession, error: waError } = await supabase
      .from('wa_sessions')
      .select('status, wa_name, wa_number')
      .single();

    if (waError) {
      console.error('Error fetching WA session:', waError);
      throw new Error('Failed to fetch WhatsApp status');
    }

    // Get Google user info from request (set by auth middleware)
    const google = {
      connected: !!req.user,
      email: req.user?.email || null,
      avatar: req.user?.picture_url || null
    };

    const whatsapp = {
      state: waSession?.status || 'disconnected',
      name: waSession?.wa_name || null,
      number: waSession?.wa_number || null
    };

    res.json({
      google,
      whatsapp
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch status'
    });
  }
});

export default router;
