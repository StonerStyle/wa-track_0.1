import { lookup } from 'mime-types';

export function detectMimeType(buffer: Buffer, filename?: string): string {
  // Try to detect from filename first
  if (filename) {
    const detected = lookup(filename);
    if (detected) {
      return detected;
    }
  }

  // Basic file signature detection
  const header = buffer.slice(0, 12);
  
  // Image formats
  if (header.slice(0, 4).toString('hex') === 'ffd8ffe0' || 
      header.slice(0, 4).toString('hex') === 'ffd8ffe1') {
    return 'image/jpeg';
  }
  
  if (header.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return 'image/png';
  }
  
  if (header.slice(0, 6).toString('hex') === '474946383761' || 
      header.slice(0, 6).toString('hex') === '474946383961') {
    return 'image/gif';
  }
  
  // Video formats
  if (header.slice(0, 4).toString('hex') === '000001ba' || 
      header.slice(0, 4).toString('hex') === '000001b3') {
    return 'video/mpeg';
  }
  
  if (header.slice(4, 8).toString('hex') === '66747970') {
    return 'video/mp4';
  }
  
  // Audio formats
  if (header.slice(0, 4).toString('hex') === '49443303' || 
      header.slice(0, 4).toString('hex') === '49443304') {
    return 'audio/mpeg';
  }
  
  if (header.slice(0, 4).toString('hex') === '4f676753') {
    return 'audio/ogg';
  }
  
  // Document formats
  if (header.slice(0, 4).toString('hex') === '25504446') {
    return 'application/pdf';
  }
  
  if (header.slice(0, 2).toString('hex') === '504b') {
    return 'application/zip';
  }
  
  // Default to binary
  return 'application/octet-stream';
}

export function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/mpeg': 'mpg',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'text/plain': 'txt'
  };
  
  return extensions[mimeType] || 'bin';
}

export function isAllowedMimeType(mimeType: string): boolean {
  const allowedPrefixes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/zip'
  ];
  
  return allowedPrefixes.some(prefix => mimeType.startsWith(prefix));
}
