import type { RequestHandler } from 'express';
import type { LoginRequest, RegisterRequest } from '../schemas/auth.schemas.js';
import { AuthService } from '../services/auth.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  readonly register: RequestHandler = async (request, response) => {
    const authResponse = await this.authService.register(request.body as RegisterRequest);
    response.status(201).json(authResponse);
  };

  readonly login: RequestHandler = async (request, response) => {
    const authResponse = await this.authService.login(request.body as LoginRequest);
    response.json(authResponse);
  };
}