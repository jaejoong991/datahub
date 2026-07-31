import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('postgres://datahub:datahub@localhost:5432/datahub'),
  SESSION_SECRET: z.string().default('dev-session-secret-change-in-production'),
  ENCRYPTION_KEY: z.string().default('dev-encryption-key-32-bytes-long!!'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Environment validation failed:', result.error.format());
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}
