import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { Logger } from '../../../infra/logger/Logger';
import { normalizeElevatorId, getElevatorNotFoundMessage } from './CommandHelpers';

/**
 * Command to view the pushed buttons (queued floor stops) for elevators.
 * 
 * This command shows which floors are in the queue for each elevator,
 * representing the "buttons" that have been pushed either by passengers
 * inside the elevator or by external ride requests.
 */
export class ButtonsCommand extends BaseCommand {

	constructor(private readonly app: Application, logger?: Logger) {
		super(logger);
	}

	register(program: Command): void {
		program
			.command('buttons')
			.alias('btn')
			.description('Show pushed buttons (queued stops) for one or all elevators')
			.argument('[elevator-id]', 'Specific elevator ID to check (e.g., #1, 2, or Elevator#3)')
			.option('-j, --json', 'Output in JSON format')
			.option('-c, --count', 'Show only the count of queued stops')
			.action((elevatorId: string | undefined, options) => {
				this.execute(elevatorId, options);
			});
	}

	/**
	 * Execute the buttons command.
	 * 
	 * @param elevatorId - Optional specific elevator to query, or undefined for all
	 * @param options - Command options for output formatting
	 */
	private execute(
		elevatorId: string | undefined,
		options: { json?: boolean; count?: boolean }
	): void {
		try {
			// Determine which elevators to query
			let elevatorIds: string[];

			if (elevatorId) {
				// Normalize the elevator ID (supports shorthand like "#1" or "1")
				const normalizedId = normalizeElevatorId(elevatorId, this.app.elevatorService);

				if (!normalizedId) {
					this.logger.error(getElevatorNotFoundMessage(elevatorId, this.app.elevatorService));
					return;
				}

				elevatorIds = [normalizedId];
			} else {
				// No specific elevator requested, query all
				elevatorIds = this.app.elevatorService.listElevators();
			}

			// Get buttons for all requested elevators
			const buttonsData = elevatorIds.map(id => {
				try {
					const buttons = this.app.elevatorService.getPushedButtons(id);
					return { id, buttons, error: null };
				} catch (error) {
					// Handle per-elevator errors gracefully
					return {
						id,
						buttons: null,
						error: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			});

			// JSON mode: output structured data
			if (options.json) {
				const output = buttonsData.map(({ id, buttons, error }) => {
					if (error) {
						return { id, error };
					}
					return {
						id,
						buttons,
						count: buttons!.length
					};
				});
				console.log(JSON.stringify(output, null, 2));
				return;
			}

			// Count mode: just show the numbers
			if (options.count) {
				console.log('\nQueued Stop Counts:');
				console.log('─'.repeat(40));
				for (const { id, buttons, error } of buttonsData) {
					if (error) {
						console.log(`${id.padEnd(20)} Error: ${error}`);
					} else {
						console.log(`${id.padEnd(20)} ${buttons!.length} stop${buttons!.length !== 1 ? 's' : ''}`);
					}
				}
				console.log('─'.repeat(40) + '\n');
				return;
			}

			// Default mode: show all buttons in detail
			console.log('\nPushed Buttons (Queued Stops):');
			console.log('═'.repeat(70));

			for (const { id, buttons, error } of buttonsData) {
				console.log(`\n${id}:`);

				// Handle error case
				if (error) {
					this.logger.error(`  Error: ${error}`);
					continue;
				}

				// Show the queued stops
				if (buttons!.length === 0) {
					console.log('  (no queued stops)');
				} else {
					// Sort the buttons for easier reading
					const sortedButtons = [...buttons!].sort((a, b) => a - b);
					console.log(`  Floors: ${sortedButtons.join(', ')}`);
					console.log(`  Count:  ${buttons!.length} stop${buttons!.length !== 1 ? 's' : ''}`);

					// Show the order they'll be visited (unsorted, as per route)
					if (JSON.stringify(sortedButtons) !== JSON.stringify(buttons)) {
						console.log(`  Order:  ${buttons!.join(' → ')}`);
					}
				}
			}

			console.log('\n' + '═'.repeat(70) + '\n');

		} catch (error) {
			// Handle general errors
			if (error instanceof Error) {
				this.logger.error(`Failed to get buttons: ${error.message}`);
			} else {
				this.logger.error('Failed to get buttons: Unknown error');
			}
		}
	}
}

