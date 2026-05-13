import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requirePermission } from '../middleware/require-permission.js';

export function createUserRoutes(controller: UserController) {
  const router = Router();

  router.get('/', requirePermission('users:read'), asyncHandler(controller.listUsers));

  return router;
}