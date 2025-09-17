import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// GET /api/messages
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      groupId = '', 
      kind = '' 
    } = req.query;

    // Build query with joins
    let query = supabase
      .from('messages')
      .select(`
        id,
        wa_msg_id,
        ts,
        chat_id,
        sender,
        kind,
        text,
        parent_id,
        created_at,
        groups!inner(name),
        media(id, sha256, mime, bytes, storage_path)
      `)
      .order('ts', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Apply filters
    if (groupId && typeof groupId === 'string') {
      query = query.eq('group_id', groupId);
    }

    if (kind && typeof kind === 'string') {
      query = query.eq('kind', kind);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      throw new Error('Failed to fetch messages');
    }

    // Transform data for frontend
    const transformedMessages = (messages || []).map((msg: any) => ({
      id: msg.id,
      ts: msg.ts,
      group: msg.groups?.name || 'Unknown Group',
      sender: msg.sender,
      kind: msg.kind,
      text: msg.text,
      mediaUrl: msg.media ? generateSignedUrl(msg.media.storage_path) : null,
      parentId: msg.parent_id
    }));

    res.json(transformedMessages);
  } catch (error) {
    console.error('Messages endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch messages'
    });
  }
});

// Helper function to generate signed URLs for media
function generateSignedUrl(storagePath: string): string {
  // TODO: Implement proper signed URL generation using Supabase storage
  // For now, return a placeholder URL
  // In production, this should use supabase.storage.from('wa-media').createSignedUrl()
  return `https://example.com/media/${storagePath}`;
}

export default router;
