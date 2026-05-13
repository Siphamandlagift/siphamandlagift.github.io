import cors from 'cors';
import express from 'express';
import { getMultiTenantConfig } from './config.js';
import { createDatabasePool } from './database.js';
import { AuthController } from './controllers/auth.controller.js';
import { CourseController } from './controllers/course.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { UserController } from './controllers/user.controller.js';
import { authenticateRequest } from './middleware/authenticate.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found-handler.js';
import { requireCompanyScope } from './middleware/require-company-scope.js';
import { requirePermission } from './middleware/require-permission.js';
import { MultiTenantRepository } from './repositories/multitenant.repository.js';
import { createHealthRoutes } from './routes/health.routes.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createCourseRoutes } from './routes/course.routes.js';
import { createDashboardRoutes } from './routes/dashboard.routes.js';
import { createUserRoutes } from './routes/user.routes.js';
import { AuthService } from './services/auth.service.js';
import { CourseService } from './services/course.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { HealthService } from './services/health.service.js';
import { UserService } from './services/user.service.js';

export function createMultiTenantApp() {
  const config = getMultiTenantConfig();
  const pool = createDatabasePool(config);
  const repository = new MultiTenantRepository(pool);
  const healthService = new HealthService(repository);
  const authService = new AuthService(repository, config);
  const userService = new UserService(repository);
  const courseService = new CourseService(repository);
  const dashboardService = new DashboardService(repository);
  const healthController = new HealthController(healthService);
  const authController = new AuthController(authService);
  const userController = new UserController(userService);
  const courseController = new CourseController(courseService);
  const dashboardController = new DashboardController(dashboardService);
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use('/health', createHealthRoutes(healthController));
  app.use('/auth', createAuthRoutes(authController));
  app.use(authenticateRequest(repository, config));
  app.use('/dashboard', requireCompanyScope(), requirePermission('dashboard:read'), createDashboardRoutes(dashboardController));
  app.use('/users', requireCompanyScope(), requirePermission('users:read'), createUserRoutes(userController));
  app.use('/courses', requireCompanyScope(), requirePermission('courses:read'), createCourseRoutes(courseController));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, config, pool };
}