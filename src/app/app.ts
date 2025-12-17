import { Logger } from '../infra/logger/Logger';
import { HealthService } from './health/HealthService';
import { CreateHeapChecker } from './health/HeapCheck';
import type { AppOptions } from '../options';
import { ElevatorService } from '../domain/services/ElevatorService';
import { Elevator } from '../domain/elevator/Elevator';
import { InsertOrder } from '../domain/strategies/InsertOrder';

/**
 * Main Application class that initializes and runs the core application.
 * This is the central application that runs regardless of which APIs are attached.
 */
export class Application {
	public readonly healthService: HealthService;
	public readonly elevatorService: ElevatorService;

	/**
	 * Initialize the application and all its services
	 * @param options - The application options
	 */
	constructor(public readonly options: AppOptions, public readonly logger?: Logger) {

		// Initialize health service which will use to monitor the 
		// load and functionality on the system (this was really only
		// created as a first simple service to make sure things were
		// working and we could test the cli)
		this.healthService = new HealthService();
		this.healthService.registerCheck(CreateHeapChecker());


		// Initialize the main elevator service and populate it with elevators
		this.elevatorService = new ElevatorService(this.options, new Logger('ElevatorService'));
		for (let i = 0; i < this.options.NR_OF_ELEVATORS; i++) {
			const id = `Elevator#${(i + 1).toString()}`; //so we get pretty names starting at 1
			const logger = new Logger(id);
			const strategy = new InsertOrder(this.options, logger);
			const elevator = new Elevator(id, strategy, this.options, logger);
			this.elevatorService.addElevator(elevator);
		}


	}

	/**
	 * Starts the application and initializes all core services.
	 */
	public async start(): Promise<void> {
		this.logger?.debug('Starting Stabelo Elevator Application...');

		// Start core services
		this.healthService.start();
		this.elevatorService.start();


		this.logger?.info('Application started successfully');

	}

	/**
	 * Stops the application and gracefully shuts down all services.
	 */
	public async stop(): Promise<void> {
		this.logger?.info('Stopping application...');

		// Shutdown services
		this.healthService.shutdown();

		this.logger?.info('Application stopped');
	}




}

