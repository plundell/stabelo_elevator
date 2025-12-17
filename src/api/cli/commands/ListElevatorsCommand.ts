import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';

/**
 * Command to list all elevators in the elevator service.
 * 
 * This command provides an overview of all elevators, showing their IDs,
 * current state, floor position, and queued stops. Useful for monitoring
 * the overall system status at a glance.
 */
export class ListElevatorsCommand extends BaseCommand {

	constructor(private readonly app: Application) {
		super('ListElevatorsCommand');
	}

	register(program: Command): void {
		program
			.command('list')
			.alias('ls')
			.description('List all elevators and their current status')
			.option('-j, --json', 'Output in JSON format')
			.option('-s, --simple', 'Show only elevator IDs')
			.action((options) => {
				this.execute(options);
			});
	}

	/**
	 * Execute the list elevators command.
	 * 
	 * @param options - Command options for output formatting
	 */
	private execute(options: { json?: boolean; simple?: boolean }): void {
		try {
			// Get all elevator IDs from the service
			const elevatorIds = this.app.elevatorService.listElevators();

			// Handle case where no elevators exist (shouldn't happen in normal operation)
			if (elevatorIds.length === 0) {
				this.logger.warn('No elevators found in the service');
				return;
			}

			// Simple mode: just show the IDs
			if (options.simple) {
				console.log(elevatorIds.join('\n'));
				return;
			}

			// Get detailed state for all elevators
			const allStates = this.app.elevatorService.getAllElevatorStates();
			const allButtons = this.app.elevatorService.getAllPushedButtons();

			// JSON mode: output structured data
			if (options.json) {
				const elevators = elevatorIds.map(id => {
					const state = allStates[id];
					// Extract floor information based on state type
					const floorInfo = 'atFloor' in state
						? { floor: state.atFloor }
						: { fromFloor: state.fromFloor, toFloor: state.toFloor };

					return {
						id,
						state: state.type,
						...floorInfo,
						queuedStops: allButtons[id]
					};
				});
				console.log(JSON.stringify(elevators, null, 2));
				return;
			}

			// Default mode: pretty formatted table
			console.log('\nElevator Status Overview:');
			console.log('─'.repeat(70));
			console.log(
				'ID'.padEnd(15) +
				'State'.padEnd(15) +
				'Floor'.padEnd(10) +
				'Queued Stops'
			);
			console.log('─'.repeat(70));

			// Print each elevator's status
			for (const id of elevatorIds) {
				const state = allStates[id];
				const buttons = allButtons[id];

				// Format floor information based on state type
				// If stationary (idle/doorsOpen), show current floor
				// If moving, show "from → to"
				const floorStr = 'atFloor' in state
					? state.atFloor.toString()
					: `${state.fromFloor}→${state.toFloor}`;

				const stopsStr = buttons.length > 0
					? buttons.join(', ')
					: '(none)';

				console.log(
					id.padEnd(15) +
					state.type.padEnd(15) +
					floorStr.padEnd(10) +
					stopsStr
				);
			}

			console.log('─'.repeat(70));
			console.log(`Total: ${elevatorIds.length} elevator${elevatorIds.length !== 1 ? 's' : ''}\n`);

		} catch (error) {
			// Handle errors gracefully
			if (error instanceof Error) {
				this.logger.error(`Failed to list elevators: ${error.message}`);
			} else {
				this.logger.error('Failed to list elevators: Unknown error');
			}
		}
	}
}

