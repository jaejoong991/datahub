import Fastify from 'fastify';
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

async function main() {
  const env = getEnv();

  await runMigrations();
  if (env.NODE_ENV === 'development') {
    await runSeed();
  } else {
    logInfo(`Seed dilewati — NODE_ENV=${env.NODE_ENV} (hanya jalan otomatis di development)`);
  }

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

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

main();
