import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { Logger } from '../../../infra/logger/Logger';

/**
 * Command to simulate elevator traffic by generating random ride requests.
 * 
 * This command is useful for testing and demonstrating the elevator system
 * under load. It generates ride requests at random intervals over a specified
 * time period, simulating realistic elevator usage patterns.
 */
export class SimulateCommand extends BaseCommand {
	private isRunning: boolean = false;
	private completedRides: number = 0;
	private failedRides: number = 0;

	constructor(private readonly app: Application, logger?: Logger) {
		super(logger);
	}

	register(program: Command): void {
		program
			.command('simulate')
			.alias('sim')
			.description('Simulate random elevator traffic')
			.option('-n, --number <rides>', 'Number of rides to generate', '100')
			.option('-t, --time <seconds>', 'Time period to spread rides over (in seconds)', '30')
			.option('-v, --verbose', 'Show each ride as it is added')
			.option('-s, --stats', 'Show statistics at the end')
			.action((options) => {
				this.execute(options);
			});
	}

	/**
	 * Execute the simulate command.
	 * 
	 * Generates random ride requests spread out over the specified time period.
	 * Each ride has randomly selected pickup and dropoff floors within the
	 * configured floor range.
	 * 
	 * @param options - Command options including number of rides and time period
	 */
	private async execute(options: { 
		number?: string; 
		time?: string; 
		verbose?: boolean;
		stats?: boolean;
	}): Promise<void> {
		try {
			// Parse and validate options
			const numRides = parseInt(options.number || '100', 10);
			const timeSeconds = parseInt(options.time || '30', 10);

			if (isNaN(numRides) || numRides < 1) {
				this.logger.error('Number of rides must be at least 1');
				return;
			}

			if (isNaN(timeSeconds) || timeSeconds < 1) {
				this.logger.error('Time period must be at least 1 second');
				return;
			}

			// Get floor range from configuration
			const minFloor = this.app.elevatorService.options.MIN_FLOOR;
			const maxFloor = this.app.elevatorService.options.MAX_FLOOR;
			const floorRange = maxFloor - minFloor + 1;

			if (floorRange < 2) {
				this.logger.error('Need at least 2 floors to simulate rides');
				return;
			}

			// Display simulation info
			this.logger.info(`Starting simulation: ${numRides} rides over ${timeSeconds} seconds`);
			this.logger.info(`Floor range: ${minFloor} to ${maxFloor}`);
			
			if (!options.verbose) {
				this.logger.info('Generating rides... (use -v to see each ride)');
			}

			this.isRunning = true;
			this.completedRides = 0;
			this.failedRides = 0;

			// Calculate time intervals for each ride
			// Spread rides randomly across the time period
			const timeMs = timeSeconds * 1000;
			const rideTimestamps = this.generateRideTimestamps(numRides, timeMs);

			// Schedule all the rides
			const startTime = Date.now();
			
			for (let i = 0; i < numRides; i++) {
				if (!this.isRunning) break;

				const delay = rideTimestamps[i];
				
				// Wait until it's time for this ride
				await this.sleep(delay - (Date.now() - startTime));

				// Generate random pickup and dropoff floors
				const pickup = this.randomFloor(minFloor, maxFloor);
				let dropoff = this.randomFloor(minFloor, maxFloor);
				
				// Ensure pickup and dropoff are different
				while (dropoff === pickup && floorRange > 1) {
					dropoff = this.randomFloor(minFloor, maxFloor);
				}

				// Add the ride
				try {
					const elevatorId = await this.app.elevatorService.addRide(pickup, dropoff);
					this.completedRides++;
					
					if (options.verbose) {
						this.logger.info(`[${this.completedRides}/${numRides}] Ride ${pickup}→${dropoff} assigned to ${elevatorId.replace('Elevator', '')}`);
					}
				} catch (error) {
					this.failedRides++;
					if (options.verbose) {
						this.logger.error(`Failed to add ride ${pickup}→${dropoff}: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}
			}

			// Show completion message
			this.logger.info(`Simulation complete: ${this.completedRides} rides added, ${this.failedRides} failed`);

			// Show statistics if requested
			if (options.stats) {
				this.showStatistics();
			}

		} catch (error) {
			// Handle errors gracefully
			this.isRunning = false;
			if (error instanceof Error) {
				this.logger.error(`Simulation failed: ${error.message}`);
			} else {
				this.logger.error('Simulation failed: Unknown error');
			}
		}
	}

	/**
	 * Generate random timestamps for when each ride should be added.
	 * 
	 * This spreads the rides out randomly across the time period, simulating
	 * realistic traffic patterns.
	 * 
	 * @param numRides - Number of rides to generate
	 * @param timeMs - Total time period in milliseconds
	 * @returns Sorted array of timestamps (relative to start time)
	 */
	private generateRideTimestamps(numRides: number, timeMs: number): number[] {
		const timestamps: number[] = [];
		
		// Generate random timestamps
		for (let i = 0; i < numRides; i++) {
			timestamps.push(Math.random() * timeMs);
		}
		
		// Sort so we can schedule them in order
		return timestamps.sort((a, b) => a - b);
	}

	/**
	 * Generate a random floor number within the given range (inclusive).
	 * 
	 * @param min - Minimum floor number
	 * @param max - Maximum floor number
	 * @returns Random floor number
	 */
	private randomFloor(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	/**
	 * Sleep for a specified number of milliseconds.
	 * 
	 * @param ms - Number of milliseconds to sleep
	 * @returns Promise that resolves after the delay
	 */
	private sleep(ms: number): Promise<void> {
		if (ms <= 0) return Promise.resolve();
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Display statistics about the elevator system after simulation.
	 */
	private showStatistics(): void {
		console.log('\n' + '═'.repeat(70));
		console.log('Simulation Statistics');
		console.log('═'.repeat(70));

		const states = this.app.elevatorService.getAllElevatorStates();
		const buttons = this.app.elevatorService.getAllPushedButtons();
		const elevatorIds = this.app.elevatorService.listElevators();

		// Calculate statistics
		const idleCount = elevatorIds.filter(id => states[id].type === 'idle').length;
		const movingCount = elevatorIds.filter(id => 
			states[id].type === 'movingUp' || states[id].type === 'movingDown'
		).length;
		const doorsOpenCount = elevatorIds.filter(id => states[id].type === 'doorsOpen').length;
		const totalQueuedStops = elevatorIds.reduce((sum, id) => sum + buttons[id].length, 0);

		console.log(`\nRides:`);
		console.log(`  Total Generated:   ${this.completedRides + this.failedRides}`);
		console.log(`  Successfully Added: ${this.completedRides}`);
		console.log(`  Failed:            ${this.failedRides}`);

		console.log(`\nElevator States:`);
		console.log(`  Idle:              ${idleCount}`);
		console.log(`  Moving:            ${movingCount}`);
		console.log(`  Doors Open:        ${doorsOpenCount}`);

		console.log(`\nQueue:`);
		console.log(`  Total Queued Stops: ${totalQueuedStops}`);
		console.log(`  Avg per Elevator:   ${(totalQueuedStops / elevatorIds.length).toFixed(2)}`);

		// Show individual elevator queues
		console.log(`\nPer-Elevator Queues:`);
		for (const id of elevatorIds) {
			const shortId = id.replace('Elevator', '');
			const queueLength = buttons[id].length;
			console.log(`  ${shortId}: ${queueLength} stop${queueLength !== 1 ? 's' : ''}`);
		}

		console.log('\n' + '═'.repeat(70) + '\n');
	}

	/**
	 * Stop the simulation.
	 */
	stop(): void {
		this.isRunning = false;
	}
}

