import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { Logger } from '../../../infra/logger/Logger';

/**
 * Command to list all elevators in the elevator service.
 * 
 * This command provides an overview of all elevators, showing their IDs,
 * current state, floor position, and queued stops. Useful for monitoring
 * the overall system status at a glance.
 */
export class ListElevatorsCommand extends BaseCommand {

	constructor(private readonly app: Application, logger?: Logger) {
		super(logger);
	}

	register(program: Command): void {
		program
			.command('list')
			.alias('ls')
			.description('List all elevators and their current status')
			.option('-j, --json', 'Output in JSON format')
			.option('-s, --simple', 'Show only elevator IDs')
			.option('-w, --watch', 'Watch mode: continuously update the display')
			.option('-i, --interval <ms>', 'Update interval in milliseconds for watch mode', '500')
			.action((options) => {
				this.execute(options);
			});
	}

	/**
	 * Execute the list elevators command.
	 * 
	 * @param options - Command options for output formatting
	 */
	private execute(options: { json?: boolean; simple?: boolean; watch?: boolean; interval?: string }): void {
		// If watch mode is enabled, set up continuous updates
		if (options.watch) {
			this.executeWatchMode(options);
			return;
		}

		// Otherwise, run once and return
		this.renderList(options);
	}

	/**
	 * Execute the list command in watch mode with continuous updates.
	 * 
	 * @param options - Command options for output formatting
	 */
	private executeWatchMode(options: { json?: boolean; simple?: boolean; interval?: string }): void {
		const interval = parseInt(options.interval || '500', 10);

		if (isNaN(interval) || interval < 100) {
			this.logger.error('Interval must be at least 100ms');
			return;
		}

		let isWatching = true;

		// Clear screen and show initial render
		this.clearScreen();
		this.renderList(options);
		console.log('\nPress q or Esc to stop watching (Ctrl+C to exit app)\n');

		// Set up interval to continuously update
		const updateInterval = setInterval(() => {
			if (!isWatching) {
				clearInterval(updateInterval);
				return;
			}
			this.clearScreen();
			this.renderList(options);
			console.log('\nPress q or Esc to stop watching (Ctrl+C to exit app)\n');
		}, interval);

		// Save original stdin settings and enable raw mode
		const wasRaw = process.stdin.isRaw;
		const wasResumed = process.stdin.readableFlowing !== null;

		process.stdin.setRawMode(true);
		if (!wasResumed) {
			process.stdin.resume();
		}

		// Listen for keypresses
		const keypressHandler = (chunk: Buffer) => {
			// Check for 'q' key (ASCII 113) or Esc key (ASCII 27)
			if (chunk[0] === 113 || chunk[0] === 27) {
				// Stop watching
				isWatching = false;
				clearInterval(updateInterval);

				// Restore stdin settings
				if (wasRaw !== undefined) {
					process.stdin.setRawMode(wasRaw);
				}
				if (!wasResumed) {
					process.stdin.pause();
				}

				process.stdin.removeListener('data', keypressHandler);

				// Clear the screen one last time and show stop message
				this.clearScreen();
				console.log('Watch mode stopped\n');
			}
			// Ctrl+C is ASCII code 3 - let it propagate to exit the app
			else if (chunk[0] === 3) {
				// Clean up before exit
				clearInterval(updateInterval);
				if (wasRaw !== undefined) {
					process.stdin.setRawMode(wasRaw);
				}
				process.stdin.removeListener('data', keypressHandler);
				// Let the signal propagate
				process.kill(process.pid, 'SIGINT');
			}
		};

		process.stdin.on('data', keypressHandler);
	}

	/**
	 * Clear the terminal screen and move cursor to top-left.
	 * Uses ANSI escape codes for cross-platform terminal clearing.
	 */
	private clearScreen(): void {
		// Clear screen: \x1Bc (full reset) or \x1B[2J (clear) + \x1B[H (home)
		// Using the more compatible clear + home approach
		process.stdout.write('\x1B[2J\x1B[H');
	}

	/**
	 * Render the elevator list once.
	 * 
	 * @param options - Command options for output formatting
	 */
	private renderList(options: { json?: boolean; simple?: boolean }): void {
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

