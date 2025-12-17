import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import { HealthCheckUseCase } from '../../../app/health/HealthService';
import { HealthService } from '../../../domain/health/HealthService';

// Dependency injection setup
const healthService = new HealthService();
const healthCheckUseCase = new HealthCheckUseCase(healthService);
const healthController = new HealthController(healthCheckUseCase);

export const healthRouter = Router();

healthRouter.get('/', healthController.getHealth);

