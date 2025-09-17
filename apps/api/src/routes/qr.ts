import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { ConflictError, TooManyRequestsError } from '../middleware/error';

const router = Router();

// Store last QR refresh time to implement rate limiting
let lastQrRefresh: number = 0;
const QR_REFRESH_COOLDOWN = 3000; // 3 seconds

// GET /api/qr
router.get('/qr', async (req: Request, res: Response) => {
  try {
    // Get WhatsApp session status
    const { data: waSession, error } = await supabase
      .from('wa_sessions')
      .select('status, detail')
      .single();

    if (error) {
      console.error('Error fetching WA session:', error);
      throw new Error('Failed to fetch QR data');
    }

    // If connected, return empty object (no QR needed)
    if (waSession?.status === 'connected') {
      return res.json({});
    }

    // Return QR data from session detail
    const qrData = waSession?.detail || {};
    res.json({
      qr: qrData.qr || null,
      expiresAt: qrData.expiresAt || null
    });
  } catch (error) {
    console.error('QR endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch QR data'
    });
  }
});

// POST /api/wa/refresh-qr
router.post('/wa/refresh-qr', async (req: Request, res: Response) => {
  try {
    // Check if already connected
    const { data: waSession, error: fetchError } = await supabase
      .from('wa_sessions')
      .select('status')
      .single();

    if (fetchError) {
      console.error('Error fetching WA session:', fetchError);
      throw new Error('Failed to check WhatsApp status');
    }

    if (waSession?.status === 'connected') {
      throw new ConflictError('Cannot refresh QR while connected');
    }

    // Rate limiting check
    const now = Date.now();
    if (now - lastQrRefresh < QR_REFRESH_COOLDOWN) {
      throw new TooManyRequestsError('QR refresh too frequent. Please wait 3 seconds.');
    }

    // Set runtime flag for worker to generate new QR
    const { error: flagError } = await supabase
      .from('runtime_flags')
      .upsert({
        key: 'wa_refresh_qr_requested',
        value: { at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      });

    if (flagError) {
      console.error('Error setting refresh QR flag:', flagError);
      throw new Error('Failed to request QR refresh');
    }

    lastQrRefresh = now;
    res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof ConflictError || error instanceof TooManyRequestsError) {
      throw error;
    }
    console.error('Refresh QR endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to refresh QR'
    });
  }
});

// POST /api/wa/disconnect
router.post('/wa/disconnect', async (req: Request, res: Response) => {
  try {
    // Set runtime flag for worker to disconnect
    const { error } = await supabase
      .from('runtime_flags')
      .upsert({
        key: 'wa_disconnect_requested',
        value: { at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error setting disconnect flag:', error);
      throw new Error('Failed to request disconnect');
    }

    res.status(202).json({ ok: true });
  } catch (error) {
    console.error('Disconnect endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to disconnect WhatsApp'
    });
  }
});

export default router;
