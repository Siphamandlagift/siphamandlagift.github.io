import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../types.js';
import { DashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  readonly getDashboard: RequestHandler = async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const dashboard = await this.dashboardService.getDashboard(authenticatedRequest.auth!);
    response.json(dashboard);
  };
}