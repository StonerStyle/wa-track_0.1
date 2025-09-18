import { createHash } from 'crypto';

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}