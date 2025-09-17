import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types (basic structure - expand as needed)
export interface Group {
  id: string;
  wa_group_id: string;
  name: string;
  monitor: boolean;
  last_seen_ts?: string;
  created_at: string;
}

export interface Message {
  id: string;
  wa_msg_id: string;
  ts: string;
  chat_id: string;
  sender: string;
  kind: 'text' | 'image' | 'video' | 'audio' | 'doc' | 'other';
  text?: string;
  media_id?: string;
  group_id?: string;
  parent_id?: string;
  raw: Record<string, any>;
  created_at: string;
}

export interface Media {
  id: string;
  sha256: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  duration_s?: number;
  storage_path: string;
  created_at: string;
}

export interface WaSession {
  id: string;
  status: 'connected' | 'connecting' | 'disconnected';
  wa_number?: string;
  wa_name?: string;
  creds_json: Record<string, any>;
  keys_json: Record<string, any>;
  detail: Record<string, any>;
  last_status_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  kind: 'connect' | 'disconnect' | 'reconnect' | 'qr_generated' | 'discovery' | 'group_rename' | 'ingest' | 'error';
  at: string;
  detail: Record<string, any>;
}

export interface RuntimeFlag {
  key: string;
  value: Record<string, any>;
  updated_at: string;
}
