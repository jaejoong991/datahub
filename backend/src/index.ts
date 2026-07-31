import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from './lib/env.js';
import { closeDb } from './lib/db.js';
import { runMigrations } from './lib/migrate.js';
import { runSeed } from './lib/seed.js';
import { logInfo, logError } from './lib/logger.js';
import { authRoutes } from './web/routes/auth.js';
import { syncRoutes } from './web/routes/sync.js';
import { financeRoutes } from './web/routes/finance.js';
import { salesRoutes } from './web/routes/sales.js';
import { productsRoutes } from './web/routes/products.js';
import { warehouseRoutes } from './web/routes/warehouse.js';
import { adminRoutes } from './web/routes/admin.js';
import { adminPlanRoutes } from './web/routes/admin-plans.js';
import { adminRoleRoutes } from './web/routes/admin-roles.js';

/* Seam untuk testing: bangun instance Fastify lengkap (plugin + semua route)
   TANPA listen() dan TANPA migrasi/seed. Dipakai main() di bawah maupun test
   lewat app.inject() — jadi test tidak perlu bind port. */
export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  /* Error handler global — dulu tidak ada, jadi throw yang tidak ketangkep
     (mis. admin.ts throw new Error('User tidak ditemukan.')) balik ke client
     apa adanya lewat body default Fastify, bocorin detail internal. Sekarang:
     - log lengkap di server (message + stack lewat logError)
     - 5xx → pesan generik ke client, detail asli TIDAK pernah sampai keluar
     - 4xx yang sudah dilempar plugin (mis. @fastify/rate-limit → 429) TETAP
       pakai status & message aslinya — cuma dibungkus ke shape {message, code}
       konsisten sama respons error rute lain di app ini. */
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const statusCode = err.statusCode ?? 500;
    logError(`Unhandled error on ${req.method} ${req.url}`, err);
    if (statusCode >= 500) {
      reply.status(500).send({ message: 'Terjadi kesalahan pada server.', code: 'internal_error' });
      return;
    }
    reply.status(statusCode).send({ message: err.message, code: err.code ?? 'error' });
  });

  await authRoutes(app);
  await syncRoutes(app);
  await financeRoutes(app);
  await salesRoutes(app);
  await productsRoutes(app);
  await warehouseRoutes(app);
  await adminRoutes(app);
  await adminPlanRoutes(app);
  await adminRoleRoutes(app);

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  return app;
}

async function main() {
  const env = getEnv();

  await runMigrations();
  if (env.NODE_ENV === 'development') {
    await runSeed();
  } else {
    logInfo(`Seed dilewati — NODE_ENV=${env.NODE_ENV} (hanya jalan otomatis di development)`);
  }

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logInfo(`Server running on port ${env.PORT}`);
  } catch (err) {
    logError('Failed to start server', err);
    process.exit(1);
  }

  const shutdown = async () => {
    logInfo('Shutting down...');
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Auto-execute hanya saat file ini dijalankan langsung (npm run dev / node dist/index.js),
// bukan saat di-import — buildApp() diimpor test lewat app.inject() dan tidak boleh
// ikut memicu migrasi/seed/listen.
const mainUrl = process.argv[1];
if (mainUrl && (mainUrl.endsWith('/index.ts') || mainUrl.endsWith('\\index.ts') || mainUrl.endsWith('/index.js') || mainUrl.endsWith('\\index.js'))) {
  main();
}
