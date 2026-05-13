import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { HealthController } from '../controllers/health.controller.js';

export function createHealthRoutes(controller: HealthController) {
  const router = Router();

  router.get('/', asyncHandler(controller.getHealth));

  return router;
}