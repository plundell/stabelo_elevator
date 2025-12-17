import { Logger } from '../infra/logger/Logger';
import { HealthService } from './health/HealthService';
import { CreateHeapChecker } from './health/HeapCheck';
import type { AppOptions } from '../options';

/**
 * Main Application class that initializes and runs the core application.
 * This is the central application that runs regardless of which APIs are attached.
 */
export class Application {
	public readonly healthService: HealthService;
	public readonly logger: Logger = new Logger('App');

	constructor(public readonly options: AppOptions) {
		//Make sure the options are immutable
		Object.freeze(this.options);

		// Initialize core services
		this.healthService = new HealthService();
		this.healthService.registerCheck(CreateHeapChecker());
	}

	/**
	 * Starts the application and initializes all core services.
	 */
	public async start(): Promise<void> {
		this.logger.debug('Starting Stabelo Elevator Application...');

		// Initialize and start core services
		this.healthService.start();

		this.logger.info('Application started successfully');

	}

	/**
	 * Stops the application and gracefully shuts down all services.
	 */
	public async stop(): Promise<void> {
		this.logger.info('Stopping application...');

		// Shutdown services
		this.healthService.shutdown();

		this.logger.info('Application stopped');
	}




}

