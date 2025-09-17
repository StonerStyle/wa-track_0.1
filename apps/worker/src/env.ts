import { z } from 'zod';
import { config } from 'dotenv';

// Load .env file explicitly
config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SIGNED_URL_TTL_DAYS: z.string().transform(Number).default('7'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  WORKER_POLL_MS: z.string().transform(Number).default('2000'),
  WORKER_MAX_MEDIA_MB: z.string().transform(Number).default('25'),
  WORKER_BACKOFF_BASE_MS: z.string().transform(Number).default('1000'),
  WORKER_BACKOFF_MAX_MS: z.string().transform(Number).default('30000'),
  PORT: z.string().transform(Number).default('3001'),
});

// Parse with better error handling
let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('Environment validation failed:');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.startsWith('SUPABASE')));
  console.error(error);
  process.exit(1);
}

export { env };

export type Env = z.infer<typeof envSchema>;
