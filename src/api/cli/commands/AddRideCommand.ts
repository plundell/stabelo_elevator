import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';

/**
 * Command to add a ride request to the elevator service.
 * 
 * This command allows users to request an elevator pickup, optionally 
 * with a dropoff floor. The elevator service will automatically select 
 * the best elevator to handle the request based on the configured strategy.
 */
export class AddRideCommand extends BaseCommand {

	constructor(private readonly app: Application) {
		super('AddRideCommand');
	}

	register(program: Command): void {
		program
			.command('ride')
			.alias('r')
			.description('Request an elevator ride')
			.argument('<pickup>', 'Floor to pickup from (integer)', this.parseFloor)
			.argument('[dropoff]', 'Floor to drop off at (integer, optional)', this.parseFloor)
			.option('-v, --verbose', 'Show detailed information about the selected elevator')
			.action(async (pickup: number, dropoff: number | undefined, options) => {
				await this.execute(pickup, dropoff, options);
			});
	}

	/**
	 * Parse and validate a floor argument from the command line.
	 * @param value - The string value from the command line
	 * @returns The parsed floor number
	 * @throws Error if the value is not a valid integer
	 */
	private parseFloor(value: string): number {
		const parsed = parseInt(value, 10);
		if (isNaN(parsed)) {
			throw new Error(`Invalid floor number: ${value}. Must be an integer.`);
		}
		return parsed;
	}

	/**
	 * Execute the add ride command.
	 * 
	 * @param pickup - The floor to pickup from
	 * @param dropoff - Optional floor to drop off at
	 * @param options - Command options including verbose flag
	 */
	private async execute(
		pickup: number,
		dropoff: number | undefined,
		options: { verbose?: boolean }
	): Promise<void> {
		try {
			// Construct a human-readable ride description
			const rideDesc = dropoff !== undefined
				? `ride from floor ${pickup} to floor ${dropoff}`
				: `pickup at floor ${pickup}`;

			this.logger.info(`Requesting ${rideDesc}...`);

			// Request the ride from the elevator service
			const elevatorId = await this.app.elevatorService.addRide(pickup, dropoff);

			// Success! Let the user know which elevator was assigned
			this.logger.info(`✓ Ride assigned to ${elevatorId}`);

			// If verbose mode is enabled, show additional details about the elevator
			if (options.verbose) {
				const state = this.app.elevatorService.getElevatorState(elevatorId);
				const buttons = this.app.elevatorService.getPushedButtons(elevatorId);

				console.log(`\nElevator Details:`);
				console.log(`  ID: ${elevatorId}`);
				console.log(`  Current State: ${state.type}`);

				// Display floor information based on state type
				if ('atFloor' in state) {
					console.log(`  Current Floor: ${state.atFloor}`);
				} else {
					console.log(`  Moving: ${state.fromFloor} → ${state.toFloor}`);
				}

				console.log(`  Queued Stops: ${buttons.length > 0 ? buttons.join(', ') : 'none'}`);
			}

		} catch (error) {
			// Handle errors gracefully and provide helpful feedback
			if (error instanceof Error) {
				this.logger.error(`Failed to add ride: ${error.message}`);
			} else {
				this.logger.error('Failed to add ride: Unknown error');
			}
		}
	}
}

