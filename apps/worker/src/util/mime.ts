import { lookup } from 'mime-types';

export function getMimeType(filename: string): string {
  return lookup(filename) || 'application/octet-stream';
}