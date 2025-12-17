import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { ElevatorStates } from '../../../domain/elevator/types';

/**
 * Command to get detailed status information about one or all elevators.
 * 
 * This command provides in-depth information about elevator state including:
 * - Current state type (idle, moving, doors opening, etc.)
 * - Current floor position
 * - Queued floor stops
 * - State timing information
 */
export class StatusCommand extends BaseCommand {

	constructor(private readonly app: Application) {
		super('StatusCommand');
	}

	register(program: Command): void {
		program
			.command('status')
			.alias('st')
			.description('Get detailed status of one or all elevators')
			.argument('[elevator-id]', 'Specific elevator ID to check (optional)')
			.option('-j, --json', 'Output in JSON format')
			.action((elevatorId: string | undefined, options) => {
				this.execute(elevatorId, options);
			});
	}

	/**
	 * Execute the status command.
	 * 
	 * @param elevatorId - Optional specific elevator to query, or undefined for all
	 * @param options - Command options for output formatting
	 */
	private execute(elevatorId: string | undefined, options: { json?: boolean }): void {
		try {
			// Determine which elevators to query
			const elevatorIds = elevatorId 
				? [elevatorId] 
				: this.app.elevatorService.listElevators();

			// Validate that the specific elevator exists if one was requested
			if (elevatorId && elevatorIds.length === 0) {
				this.logger.error(`Elevator '${elevatorId}' not found`);
				return;
			}

			// Get state for all requested elevators
			const statuses = elevatorIds.map(id => {
				try {
					const state = this.app.elevatorService.getElevatorState(id);
					const buttons = this.app.elevatorService.getPushedButtons(id);
					return { id, state, buttons, error: null };
				} catch (error) {
					// Handle per-elevator errors gracefully
					return { 
						id, 
						state: null, 
						buttons: null, 
						error: error instanceof Error ? error.message : 'Unknown error' 
					};
				}
			});

			// JSON mode: output structured data
			if (options.json) {
				const output = statuses.map(({ id, state, buttons, error }) => {
					if (error) {
						return { id, error };
					}
					
					// Extract floor information based on state type
					const floorInfo = 'atFloor' in state! 
						? { floor: state!.atFloor }
						: { fromFloor: state!.fromFloor, toFloor: state!.toFloor };
					
					return {
						id,
						state: {
							type: state!.type,
							...floorInfo,
							startTime: state!.startTime,
							...this.getStateSpecificFields(state!)
						},
						queuedStops: buttons
					};
				});
				console.log(JSON.stringify(output, null, 2));
				return;
			}

			// Default mode: pretty formatted output
			for (const { id, state, buttons, error } of statuses) {
				console.log('\n' + '═'.repeat(70));
				console.log(`Elevator: ${id}`);
				console.log('═'.repeat(70));

				// Handle error case
				if (error) {
					this.logger.error(`Error: ${error}`);
					continue;
				}

				// Display current state
				console.log(`State:        ${state!.type}`);
				
				// Display floor information based on state type
				if ('atFloor' in state!) {
					console.log(`Floor:        ${state!.atFloor}`);
				} else {
					console.log(`From Floor:   ${state!.fromFloor}`);
					console.log(`To Floor:     ${state!.toFloor}`);
				}
				
				console.log(`Start Time:   ${new Date(state!.startTime).toISOString()}`);
				console.log(`Duration:     ${Date.now() - state!.startTime}ms`);

				// Display state-specific fields
				this.displayStateSpecificFields(state!);

				// Display queued stops
				console.log(`\nQueued Stops: ${buttons!.length > 0 ? buttons!.join(', ') : '(none)'}`);
			}

			console.log('\n' + '═'.repeat(70) + '\n');

		} catch (error) {
			// Handle general errors
			if (error instanceof Error) {
				this.logger.error(`Failed to get status: ${error.message}`);
			} else {
				this.logger.error('Failed to get status: Unknown error');
			}
		}
	}

	/**
	 * Extract state-specific fields based on the state type.
	 * Only extracts timing-related fields, not structural fields like floor numbers.
	 * 
	 * @param state - The elevator state object
	 * @returns An object containing the state-specific fields
	 */
	private getStateSpecificFields(state: ElevatorStates): Record<string, unknown> {
		const fields: Record<string, unknown> = {};
		
		// Extract timing-related fields (not floor-related, as those are handled separately)
		if ('dueTime' in state) {
			fields.dueTime = state.dueTime;
		}
		if ('willArrive' in state) {
			fields.willArrive = state.willArrive;
		}
		if ('willClose' in state) {
			fields.willClose = state.willClose;
		}
		
		return fields;
	}

	/**
	 * Display state-specific fields in a human-readable format.
	 * Only displays timing-related fields, not structural fields like floor numbers
	 * (those are already displayed above).
	 * 
	 * @param state - The elevator state object
	 */
	private displayStateSpecificFields(state: ElevatorStates): void {
		// Display timing fields specific to the current state type
		if ('dueTime' in state) {
			console.log(`Due Time:     ${new Date(state.dueTime).toISOString()}`);
			console.log(`Time to Due:  ${Math.max(0, state.dueTime - Date.now())}ms`);
		}
		if ('willArrive' in state) {
			console.log(`Will Arrive:  ${new Date(state.willArrive).toISOString()}`);
			console.log(`Time to Arr:  ${Math.max(0, state.willArrive - Date.now())}ms`);
		}
		if ('willClose' in state) {
			console.log(`Will Close:   ${new Date(state.willClose).toISOString()}`);
			console.log(`Time to Cls:  ${Math.max(0, state.willClose - Date.now())}ms`);
		}
	}
}

