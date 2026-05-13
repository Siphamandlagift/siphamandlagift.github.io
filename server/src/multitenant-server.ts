import 'dotenv/config';
import { createMultiTenantApp } from './multitenant/app.js';

const { app, config, pool } = createMultiTenantApp();
const server = app.listen(config.port, () => {
  console.log(`Multi-tenant LMS API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});