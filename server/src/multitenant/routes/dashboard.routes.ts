import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

export function createDashboardRoutes(controller: DashboardController) {
  const router = Router();

  router.get('/', asyncHandler(controller.getDashboard));

  return router;
}