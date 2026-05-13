import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validateRequest } from '../middleware/validate-request.js';
import { loginSchema, registerSchema } from '../schemas/auth.schemas.js';

export function createAuthRoutes(controller: AuthController) {
  const router = Router();

  router.post('/register', validateRequest({ body: registerSchema }), asyncHandler(controller.register));
  router.post('/login', validateRequest({ body: loginSchema }), asyncHandler(controller.login));

  return router;
}