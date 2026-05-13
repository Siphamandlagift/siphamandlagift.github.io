import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../types.js';
import { UserService } from '../services/user.service.js';

export class UserController {
  constructor(private readonly userService: UserService) {}

  readonly listUsers: RequestHandler = async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const users = await this.userService.listUsers(authenticatedRequest.auth!.companyId);
    response.json(users);
  };
}