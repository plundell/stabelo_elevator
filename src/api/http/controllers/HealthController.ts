import { Request, Response } from 'express';
import { HealthCheckUseCase } from '../../../app/health/HealthService';

export class HealthController {
	constructor(private readonly healthCheckUseCase: HealthCheckUseCase) { }

	getHealth = (_req: Request, res: Response): void => {
		try {
			const healthStatus = this.healthCheckUseCase.execute();
			res.status(200).json(healthStatus.toJSON());
		} catch (error) {
			res.status(500).json({
				status: 'error',
				message: 'Health check failed',
			});
		}
	};
}

