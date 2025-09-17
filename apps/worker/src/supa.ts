import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from './log.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types
export interface WaSession {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected';
  detail: {
    qr?: string;
    expiresAt?: string;
  } | null;
  wa_name: string | null;
  wa_number: string | null;
  creds_json: any | null;
  keys_json: any | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  wa_group_id: string;
  name: string;
  monitor: boolean;
  last_seen_ts: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  wa_msg_id: string;
  group_id: string;
  ts: string;
  chat_id: string;
  sender: string;
  kind: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'other';
  text: string | null;
  media_id: string | null;
  parent_id: string | null;
  raw: any;
  created_at: string;
}

export interface Media {
  id: string;
  sha256: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  storage_path: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event: string;
  payload: any;
  created_at: string;
}

export interface RuntimeFlag {
  id: string;
  name: string;
  value: any;
  updated_at: string;
}

// Helper functions
export async function ensureWaSessionRow(): Promise<WaSession> {
  const { data: existing, error: fetchError } = await supabase
    .from('wa_sessions')
    .select('*')
    .limit(1)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch wa_sessions: ${fetchError.message}`);
  }

  if (existing) {
    return existing;
  }

  // Create new session row
  const { data: newSession, error: insertError } = await supabase
    .from('wa_sessions')
    .insert({
      status: 'disconnected',
      detail: null,
      wa_name: null,
      wa_number: null,
      creds_json: null,
      keys_json: null
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create wa_sessions: ${insertError.message}`);
  }

  logger.info('Created new wa_sessions row');
  return newSession;
}

export async function updateWaSession(updates: Partial<WaSession>): Promise<void> {
  try {
    logger.debug('Updating wa_sessions with:', updates);
    
    // First get the session ID
    const { data: session, error: fetchError } = await supabase
      .from('wa_sessions')
      .select('id')
      .limit(1)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch session ID:', fetchError);
      throw new Error(`Failed to fetch session ID: ${fetchError.message}`);
    }

    if (!session) {
      throw new Error('No wa_sessions row found');
    }

    logger.debug('Found session ID:', session.id);

    // Update the session
    const updateData: any = {
      ...updates,
      last_status_at: new Date().toISOString()
    };
    
    // Remove updated_at if it exists since we're using last_status_at
    delete updateData.updated_at;
    
    const { error } = await supabase
      .from('wa_sessions')
      .update(updateData)
      .eq('id', session.id);

    if (error) {
      logger.error('Failed to update wa_sessions:', error);
      throw new Error(`Failed to update wa_sessions: ${error.message}`);
    }

    logger.debug('Successfully updated wa_sessions');
  } catch (error) {
    logger.error('updateWaSession error:', error);
    throw error;
  }
}

export async function logAudit(event: string, payload: any = {}): Promise<void> {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      event,
      payload
    });

  if (error) {
    logger.error('Failed to log audit event:', error);
  }
}

export async function getRuntimeFlag(name: string): Promise<RuntimeFlag | null> {
  const { data, error } = await supabase
    .from('runtime_flags')
    .select('*')
    .eq('name', name)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error(`Failed to get runtime flag ${name}:`, error);
    return null;
  }

  return data;
}

export async function clearRuntimeFlag(name: string): Promise<void> {
  const { error } = await supabase
    .from('runtime_flags')
    .update({ value: null })
    .eq('name', name);

  if (error) {
    logger.error(`Failed to clear runtime flag ${name}:`, error);
  }
}
