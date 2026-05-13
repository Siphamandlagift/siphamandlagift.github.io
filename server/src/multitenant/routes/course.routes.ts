import { Router } from 'express';
import { CourseController } from '../controllers/course.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requirePermission } from '../middleware/require-permission.js';
import { validateRequest } from '../middleware/validate-request.js';
import { createCourseSchema, updateProgressSchema } from '../schemas/course.schemas.js';

export function createCourseRoutes(controller: CourseController) {
  const router = Router();

  router.get('/', asyncHandler(controller.listCourses));
  router.post('/', requirePermission('courses:create'), validateRequest({ body: createCourseSchema }), asyncHandler(controller.createCourse));
  router.patch('/:courseId/progress', requirePermission('enrollments:self:update'), validateRequest({ body: updateProgressSchema }), asyncHandler(controller.updateProgress));

  return router;
}