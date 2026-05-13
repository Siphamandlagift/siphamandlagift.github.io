import type { RequestHandler } from 'express';
import type { CreateCourseRequest, UpdateProgressRequest } from '../schemas/course.schemas.js';
import type { AuthenticatedRequest } from '../types.js';
import { CourseService } from '../services/course.service.js';

export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  readonly listCourses: RequestHandler = async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const courses = await this.courseService.listCourses(authenticatedRequest.auth!);
    response.json(courses);
  };

  readonly createCourse: RequestHandler = async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const payload = request.body as CreateCourseRequest;
    const course = await this.courseService.createCourse(authenticatedRequest.auth!.companyId, payload.title);
    response.status(201).json(course);
  };

  readonly updateProgress: RequestHandler = async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const courseId = request.params['courseId'] as string;
    const payload = request.body as UpdateProgressRequest;
    const enrollment = await this.courseService.updateProgress(authenticatedRequest.auth!, courseId, payload.progress);
    response.json(enrollment);
  };
}