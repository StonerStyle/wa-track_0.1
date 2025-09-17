import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// GET /api/activity
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;

    // Fetch latest audit log entries
    const { data: activities, error } = await supabase
      .from('audit_log')
      .select('id, kind, at, detail')
      .order('at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      console.error('Error fetching activity:', error);
      throw new Error('Failed to fetch activity');
    }

    // Transform data for frontend
    const transformedActivities = (activities || []).map((activity: any) => ({
      id: activity.id,
      kind: activity.kind,
      at: activity.at,
      message: getActivityMessage(activity.kind, activity.detail),
      icon: getActivityIcon(activity.kind)
    }));

    res.json(transformedActivities);
  } catch (error) {
    console.error('Activity endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch activity'
    });
  }
});

// Helper function to get human-readable activity messages
function getActivityMessage(kind: string, detail: any): string {
  switch (kind) {
    case 'connect':
      return 'WhatsApp connected successfully';
    case 'disconnect':
      return 'WhatsApp disconnected';
    case 'reconnect':
      return 'WhatsApp reconnected';
    case 'qr_generated':
      return 'New QR code generated';
    case 'discovery':
      return `Discovered ${detail?.count || 0} groups`;
    case 'group_rename':
      return `Group renamed from "${detail?.from}" to "${detail?.to}"`;
    case 'ingest':
      return `Ingested ${detail?.count || 0} messages`;
    case 'error':
      return `Error: ${detail?.message || 'Unknown error'}`;
    default:
      return 'System activity';
  }
}

// Helper function to get activity icons
function getActivityIcon(kind: string): string {
  switch (kind) {
    case 'connect':
    case 'reconnect':
      return 'success';
    case 'disconnect':
    case 'error':
      return 'error';
    case 'qr_generated':
    case 'discovery':
    case 'group_rename':
    case 'ingest':
      return 'info';
    default:
      return 'info';
  }
}

export default router;
