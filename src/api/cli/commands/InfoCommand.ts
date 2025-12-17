import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';

/**
 * Command to display information about the elevator service configuration.
 * 
 * This command shows the current configuration settings for the elevator
 * system, including timing parameters, floor ranges, and other options.
 */
export class InfoCommand extends BaseCommand {

	constructor(private readonly app: Application) {
		super('InfoCommand');
	}

	register(program: Command): void {
		program
			.command('info')
			.alias('i')
			.description('Display elevator service configuration and statistics')
			.option('-j, --json', 'Output in JSON format')
			.option('-c, --config-only', 'Show only configuration (no statistics)')
			.option('-s, --stats-only', 'Show only statistics (no configuration)')
			.action((options) => {
				this.execute(options);
			});
	}

	/**
	 * Execute the info command.
	 * 
	 * @param options - Command options for output formatting
	 */
	private execute(options: { json?: boolean; configOnly?: boolean; statsOnly?: boolean }): void {
		try {
			const config = this.app.elevatorService.options;

			// Gather statistics
			const elevatorIds = this.app.elevatorService.listElevators();
			const states = this.app.elevatorService.getAllElevatorStates();
			const buttons = this.app.elevatorService.getAllPushedButtons();

			// Calculate statistics
			const stats = {
				totalElevators: elevatorIds.length,
				idle: elevatorIds.filter(id => states[id].type === 'idle').length,
				moving: elevatorIds.filter(id =>
					states[id].type === 'movingUp' || states[id].type === 'movingDown'
				).length,
				doorsOpen: elevatorIds.filter(id => states[id].type === 'doorsOpen').length,
				totalQueuedStops: elevatorIds.reduce((sum, id) => sum + buttons[id].length, 0),
				running: this.app.elevatorService.isRunning(),
			};

			// JSON mode: output structured data
			if (options.json) {
				const output: any = {};
				if (!options.statsOnly) {
					output.configuration = config;
				}
				if (!options.configOnly) {
					output.statistics = stats;
				}
				console.log(JSON.stringify(output, null, 2));
				return;
			}

			// Default mode: pretty formatted output
			console.log('\n' + '═'.repeat(70));
			console.log('Elevator Service Information');
			console.log('═'.repeat(70));

			// Display configuration
			if (!options.statsOnly) {
				console.log('\n📋 Configuration:');
				console.log('─'.repeat(70));
				console.log(`  Floor Range:           ${config.MIN_FLOOR} to ${config.MAX_FLOOR} ` +
					`(${config.MAX_FLOOR - config.MIN_FLOOR + 1} floors)`);
				console.log(`  Number of Elevators:   ${config.NR_OF_ELEVATORS}`);
				console.log(`  Initial Floor:         ${config.INITIAL_FLOOR}`);
				console.log(`  Travel Time/Floor:     ${config.TRAVEL_TIME_PER_FLOOR}ms`);
				console.log(`  Door Open Time:        ${config.DOOR_OPEN_TIME}ms`);
				console.log(`  Estimation Limit:      ${config.ESTIMATION_LIMIT}ms`);
				console.log(`  Use Free First:        ${config.USE_FREE_FIRST ? 'Yes' : 'No'}`);
				console.log(`  Log Level:             ${config.LOG_LEVEL}`);
			}

			// Display statistics
			if (!options.configOnly) {
				console.log('\n📊 Statistics:');
				console.log('─'.repeat(70));
				console.log(`  Service Status:        ${stats.running ? '✓ Running' : '✗ Stopped'}`);
				console.log(`  Total Elevators:       ${stats.totalElevators}`);
				console.log(`  State Breakdown:`);
				console.log(`    - Idle:              ${stats.idle}`);
				console.log(`    - Moving:            ${stats.moving}`);
				console.log(`    - Doors Open:        ${stats.doorsOpen}`);
				console.log(`  Total Queued Stops:    ${stats.totalQueuedStops}`);

				// Calculate average queued stops per elevator
				const avgQueuedStops = stats.totalElevators > 0
					? (stats.totalQueuedStops / stats.totalElevators).toFixed(2)
					: '0.00';
				console.log(`  Avg Stops/Elevator:    ${avgQueuedStops}`);
			}

			console.log('\n' + '═'.repeat(70) + '\n');

		} catch (error) {
			// Handle errors gracefully
			if (error instanceof Error) {
				this.logger.error(`Failed to get info: ${error.message}`);
			} else {
				this.logger.error('Failed to get info: Unknown error');
			}
		}
	}
}

