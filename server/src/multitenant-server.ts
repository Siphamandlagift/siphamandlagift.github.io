import 'dotenv/config';
import { createMultiTenantApp } from './multitenant/app.js';

const { app, config } = createMultiTenantApp();
const server = app.listen(config.port, () => {
  console.log(`Multi-tenant LMS API listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);