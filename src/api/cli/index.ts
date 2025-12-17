import { Command } from 'commander';
import * as readline from 'readline';
import { HealthCommand } from './commands/HealthCommand';
import { ExitCommand } from './commands/ExitCommand';
import { HelpCommand } from './commands/HelpCommand';
import { AddRideCommand } from './commands/AddRideCommand';
import { ListElevatorsCommand } from './commands/ListElevatorsCommand';
import { StatusCommand } from './commands/StatusCommand';
import { ButtonsCommand } from './commands/ButtonsCommand';
import { WatchCommand } from './commands/WatchCommand';
import { InfoCommand } from './commands/InfoCommand';
import { SimulateCommand } from './commands/SimulateCommand';
import { LogCommand } from './commands/LogCommand';
import { Logger } from '../../infra/logger/Logger';
import { Application } from '../../app/app';
import { CliOptions } from '../../options';

export class CliApi {
	private cli: Command;
	private helpCommand: HelpCommand;
	private logger: Logger;
	private app: Application;

	constructor(app: Application, options: CliOptions) {
		this.app = app;
		this.logger = new Logger('cli', options.LOG_LEVEL);
		this.logger.debug('Initializing CLI application...');

		this.cli = new Command()
			.name('stabelo-elevator')
			.description('Stabelo Elevator CLI')
			.version('1.0.0');

		// Register all commands which the CLI should be able to run
		this.helpCommand = new HelpCommand(); //store for later where we access it directly
		this.helpCommand.register(this.cli);

		// System commands
		(new HealthCommand(this.app, this.logger)).register(this.cli);
		(new ExitCommand(this.app, this.logger)).register(this.cli);
		(new LogCommand(this.app, this.logger)).register(this.cli);

		// Elevator service commands
		(new AddRideCommand(this.app, this.logger)).register(this.cli);
		(new ListElevatorsCommand(this.app, this.logger)).register(this.cli);
		(new StatusCommand(this.app, this.logger)).register(this.cli);
		(new ButtonsCommand(this.app, this.logger)).register(this.cli);
		(new WatchCommand(this.app, this.logger)).register(this.cli);
		(new InfoCommand(this.app, this.logger)).register(this.cli);
		(new SimulateCommand(this.app, this.logger)).register(this.cli);
	}


	async run(args: string[], keepAlive: boolean = false): Promise<void> {
		// If there are commands provided, run them normally
		if (args.length > 2) {
			if (keepAlive) {
				// Prevent commander from exiting the process when HTTP server is running
				this.cli.exitOverride((err) => {
					if (err.exitCode !== 0) {
						process.exit(err.exitCode);
					}
				});
			}
			await this.cli.parseAsync(args);
			return;
		}

		// No commands provided - start interactive REPL mode
		// Always prevent commander from exiting in interactive mode (except for exit command)
		this.cli.exitOverride((err) => {
			// In interactive mode, convert exits to exceptions that we can catch
			// This allows us to handle errors gracefully without killing the process
			// Note: exit/quit commands call process.exit directly, bypassing this
			throw err;
		});

		// Start interactive REPL
		await this.startInteractiveMode();
	}

	private async startInteractiveMode(): Promise<void> {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: 'stabelo-elevator> ',
		});

		// Configure the CLI to not show help automatically after errors
		// We'll handle error display ourselves for a cleaner UX
		this.cli.showHelpAfterError(false);
		this.cli.configureOutput({
			writeErr: (str) => {
				// Intercept Commander's error output and display it through our logger
				// Remove the 'error: ' prefix that Commander adds since our logger adds it
				const message = str.replace(/^error:\s*/i, '').trim();
				if (message) {
					this.logger.error(message);
				}
			},
			// Keep normal output going to stdout as usual
			writeOut: (str) => process.stdout.write(str)
		});

		console.log('Stabelo Elevator - Interactive CLI Mode');
		console.log('Type "help" for available commands, "exit" to quit\n');
		rl.prompt();

		// Handle user input
		rl.on('line', async (line: string) => {
			const input = line.trim();

			// If we got some input...
			if (input !== '') {
				// Parse the input as if it were command line arguments
				const args = ['node', 'stabelo-elevator', ...input.split(/\s+/)];

				try {
					// Run the command, taking care to override the help command to prevent exit in interactive mode
					if (args[2] === 'help') {
						await this.helpCommand.runWithoutExiting(args);
					} else {
						await this.cli.parseAsync(args);
					}
				} catch (error) {
					// Handle command errors gracefully in interactive mode
					// This catches unknown commands, invalid arguments, etc.
					if (error instanceof Error) {
						// Commander errors often have helpful messages, so display them
						this.logger.error(error.message);
					} else {
						this.logger.error('An error occurred while executing the command');
					}
					// Don't exit - just continue to the next prompt
				}
			}

			// Re-prompt after command execution
			setImmediate(() => rl.prompt());
		});

		rl.on('close', () => {
			console.log('Exiting interactive CLI...!');
			process.exit(0);
		});
	}


}

