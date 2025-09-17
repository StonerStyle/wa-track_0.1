export function nowUTC(): string {
  return new Date().toISOString();
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function isWithinSeconds(date1: Date, date2: Date, seconds: number): boolean {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return diffMs <= seconds * 1000;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
