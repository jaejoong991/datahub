import 'dotenv/config';
import { z } from 'zod';

const DEFAULT_DATABASE_URL = 'postgres://datahub:datahub@localhost:5432/datahub';
const DEFAULT_ENCRYPTION_KEY = 'dev-encryption-key-32-bytes-long!!';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default(DEFAULT_DATABASE_URL),
  // Min 32 char selalu — dipakai untuk enkripsi token channel, bukan cuma di prod.
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY minimal 32 karakter').default(DEFAULT_ENCRYPTION_KEY),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Base URL publik backend sendiri — dipakai untuk redirect_uri OAuth Shopee.
  APP_URL: z.string().default('http://localhost:3000'),
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

    // Di production, tolak boot kalau secret masih nilai default dev — mencegah
    // deploy diam-diam dengan kredensial yang terlihat di source control.
    if (_env.NODE_ENV === 'production') {
      const offenders: string[] = [];
      if (_env.DATABASE_URL === DEFAULT_DATABASE_URL) offenders.push('DATABASE_URL');
      if (_env.ENCRYPTION_KEY === DEFAULT_ENCRYPTION_KEY) offenders.push('ENCRYPTION_KEY');
      if (offenders.length > 0) {
        console.error(
          `FATAL: environment variable(s) [${offenders.join(', ')}] masih menggunakan nilai default dev. ` +
          'Set nilai production yang sebenarnya sebelum boot di NODE_ENV=production.',
        );
        process.exit(1);
      }
    }
  }
  return _env;
}
