// API Response Types

export interface StatusResponse {
  google: {
    connected: boolean;
    email: string | null;
    avatar: string | null;
  };
  whatsapp: {
    state: 'connected' | 'connecting' | 'disconnected';
    name: string | null;
    number: string | null;
  };
}

export interface QrResponse {
  qr: string | null;
  expiresAt: string | null;
}

export interface GroupsResponse {
  items: Group[];
  total: number;
  limit: number;
  offset: number;
}

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
  ts: string;
  group: string;
  sender: string;
  kind: 'text' | 'image' | 'video' | 'audio' | 'doc' | 'other';
  text?: string;
  mediaUrl?: string | null;
  parentId?: string;
}

export interface Activity {
  id: string;
  kind: 'connect' | 'disconnect' | 'reconnect' | 'qr_generated' | 'discovery' | 'group_rename' | 'ingest' | 'error';
  at: string;
  message: string;
  icon: 'success' | 'error' | 'info';
}

export interface ApiError {
  error: string;
  message: string;
}

// Request Types
export interface ToggleGroupRequest {
  monitor: boolean;
}

// Error Codes
export type ErrorCode = 
  | 'unauthorized'
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'too_many_requests'
  | 'server_error';
