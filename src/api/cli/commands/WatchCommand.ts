import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { ElevatorStateChangeEvent } from '../../../domain/elevator/types';

/**
 * Command to watch elevator events in real-time.
 * 
 * This command subscribes to the elevator service's event stream and displays
 * state changes as they happen. Useful for monitoring system behavior and 
 * debugging elevator logic.
 */
export class WatchCommand extends BaseCommand {
	private isWatching: boolean = false;

	constructor(private readonly app: Application) {
		super('WatchCommand');
	}

	register(program: Command): void {
		program
			.command('watch')
			.alias('w')
			.description('Watch elevator events in real-time (Ctrl+C to stop)')
			.argument('[elevator-id]', 'Specific elevator ID to watch (optional, default: all)')
			.option('-a, --availability', 'Watch elevator availability events (add/remove)')
			.option('-q, --quiet', 'Show only state changes, no extra details')
			.action((elevatorId: string | undefined, options) => {
				this.execute(elevatorId, options);
			});
	}

	/**
	 * Execute the watch command.
	 * 
	 * This sets up event listeners and keeps the command running until 
	 * the user interrupts it (Ctrl+C) or types 'stop' in the REPL.
	 * 
	 * @param elevatorId - Optional specific elevator to watch, or undefined for all
	 * @param options - Command options for filtering events
	 */
	private execute(
		elevatorId: string | undefined, 
		options: { availability?: boolean; quiet?: boolean }
	): void {
		try {
			// Validate that the specific elevator exists if one was requested
			if (elevatorId) {
				const elevatorIds = this.app.elevatorService.listElevators();
				if (!elevatorIds.includes(elevatorId)) {
					this.logger.error(`Elevator '${elevatorId}' not found`);
					return;
				}
			}

			this.isWatching = true;

			// Display header
			console.log('\n' + '═'.repeat(70));
			if (elevatorId) {
				console.log(`Watching events for: ${elevatorId}`);
			} else {
				console.log('Watching events for: All elevators');
			}
			if (options.availability) {
				console.log('Including: Availability events');
			}
			console.log('Press Ctrl+C or type "stop" to exit watch mode');
			console.log('═'.repeat(70) + '\n');

			// Set up state change listeners
			if (elevatorId) {
				// Watch a specific elevator
				this.app.elevatorService.listen(elevatorId, (event: ElevatorStateChangeEvent) => {
					this.displayStateChange(elevatorId, event, options.quiet);
				});
			} else {
				// Watch all elevators via the aggregated 'state' event
				this.app.elevatorService.listen('state', (event: any) => {
					this.displayStateChange(event.elevator, event, options.quiet);
				});
			}

			// Set up availability listeners if requested
			if (options.availability) {
				this.app.elevatorService.listen('availability', (event: any) => {
					this.displayAvailabilityEvent(event);
				});
			}

			// Note: In interactive mode, the user can continue typing commands
			// The watch will continue in the background until they exit the CLI
			// or manually remove listeners (which we don't currently support via CLI)
			
		} catch (error) {
			// Handle errors gracefully
			this.isWatching = false;
			if (error instanceof Error) {
				this.logger.error(`Failed to watch events: ${error.message}`);
			} else {
				this.logger.error('Failed to watch events: Unknown error');
			}
		}
	}

	/**
	 * Display a state change event in a human-readable format.
	 * 
	 * @param elevatorId - The ID of the elevator that changed state
	 * @param event - The state change event
	 * @param quiet - If true, show minimal output
	 */
	private displayStateChange(
		elevatorId: string, 
		event: ElevatorStateChangeEvent, 
		quiet?: boolean
	): void {
		const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
		
		if (quiet) {
			// Minimal output: just the state transition
			console.log(`[${timestamp}] ${elevatorId}: ${event.from.type} → ${event.to.type}`);
		} else {
			// Detailed output: include floor information
			const fromFloor = 'atFloor' in event.from 
				? `floor ${event.from.atFloor}` 
				: `${event.from.fromFloor}→${event.from.toFloor}`;
			const toFloor = 'atFloor' in event.to 
				? `floor ${event.to.atFloor}` 
				: `${event.to.fromFloor}→${event.to.toFloor}`;
			
			console.log(
				`[${timestamp}] ${elevatorId.padEnd(15)} ` +
				`${event.from.type.padEnd(12)} (${fromFloor}) → ` +
				`${event.to.type.padEnd(12)} (${toFloor})`
			);
		}
	}

	/**
	 * Display an availability event (elevator added or removed).
	 * 
	 * @param event - The availability event
	 */
	private displayAvailabilityEvent(event: any): void {
		const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
		
		if (event.type === 'added') {
			console.log(
				`[${timestamp}] ⊕ Elevator ${event.elevator} added ` +
				`(${event.state.type} at floor ${event.state.atFloor})`
			);
		} else if (event.type === 'removed') {
			console.log(`[${timestamp}] ⊖ Elevator ${event.elevator} removed`);
		}
	}
}

