import type { RequestHandler } from 'express';
import { HealthService } from '../services/health.service.js';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  readonly getHealth: RequestHandler = async (_request, response) => {
    const health = await this.healthService.getHealthStatus();
    response.json(health);
  };
}