import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { Logger } from '../../../infra/logger/Logger';

/**
 * Command to change the log level dynamically.
 * 
 * This command allows changing the logging verbosity on the fly.
 * When setting to 'debug' level, it enters a watch mode that continuously
 * displays logs until the user presses Esc to return to 'warn' level.
 */
export class LogCommand extends BaseCommand {
	private isWatching: boolean = false;

	constructor(private readonly app: Application, logger?: Logger) {
		super(logger);
	}

	register(program: Command): void {
		program
			.command('log')
			.description('Change the log level (error, warn, info, debug)')
			.argument('[level]', 'Log level to set (error, warn, info, debug). Omit to show current level.')
			.action((level?: string) => {
				this.execute(level);
			});
	}

	/**
	 * Execute the log command.
	 * 
	 * If no level is provided, shows the current log level.
	 * If a level is provided, changes to that level.
	 * If the level is 'debug', enters watch mode where logs flow continuously.
	 * 
	 * @param level - The log level to set (optional)
	 */
	private execute(level?: string): void {
		try {
			// If no level provided, show info about log levels
			if (!level) {
				console.log('Available log levels: error, warn, info, debug');
				console.log('Usage: log <level>');
				console.log('Setting to debug will enter watch mode (press q or Esc to exit)');
				return;
			}

			// Validate the log level
			const normalizedLevel = level.toLowerCase();
			if (!['error', 'warn', 'info', 'debug'].includes(normalizedLevel)) {
				this.logger.error(`Invalid log level: ${level}`);
				console.log('Available levels: error, warn, info, debug');
				return;
			}

			// Set the new log level
			this.setLogLevel(normalizedLevel as 'error' | 'warn' | 'info' | 'debug');

			// If setting to debug, enter watch mode
			if (normalizedLevel === 'debug') {
				console.log('\n' + '═'.repeat(70));
				console.log('Debug log level activated - logs will flow continuously');
				console.log('Press q or Esc to return to warn level');
				console.log('═'.repeat(70) + '\n');

				this.enterDebugWatchMode();
			} else {
				this.logger.info(`Log level changed to: ${normalizedLevel}`);
			}

		} catch (error) {
			// Handle errors gracefully
			if (error instanceof Error) {
				this.logger.error(`Failed to change log level: ${error.message}`);
			} else {
				this.logger.error('Failed to change log level: Unknown error');
			}
		}
	}

	/**
	 * Set the log level for all loggers in the system.
	 * 
	 * This uses the static method on Logger to update all logger instances
	 * at once, making it easy to change the verbosity of the entire system.
	 * 
	 * @param level - The new log level
	 */
	private setLogLevel(level: 'error' | 'warn' | 'info' | 'debug'): void {
		// Use the static method to update all loggers at once
		Logger.setAllLogLevels(level);
	}

	/**
	 * Enter debug watch mode where logs flow continuously.
	 * 
	 * This sets up a keypress listener that will:
	 * - Exit watch mode and return to 'warn' level when q or Esc is pressed
	 * - Exit the entire app when Ctrl+C is pressed
	 */
	private enterDebugWatchMode(): void {
		this.isWatching = true;

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
				// Stop watching and return to original log levels
				this.isWatching = false;

				// Restore stdin settings
				if (wasRaw !== undefined) {
					process.stdin.setRawMode(wasRaw);
				}
				if (!wasResumed) {
					process.stdin.pause();
				}

				process.stdin.removeListener('data', keypressHandler);

				// Reset all loggers to their original levels
				Logger.resetAllLogLevels();

				console.log('\n' + '═'.repeat(70));
				console.log('Debug watch mode stopped - log levels restored to original settings');
				console.log('═'.repeat(70) + '\n');
			}
			// Ctrl+C is ASCII code 3 - let it propagate to exit the app
			else if (chunk[0] === 3) {
				// Clean up before exit
				this.isWatching = false;
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
}

