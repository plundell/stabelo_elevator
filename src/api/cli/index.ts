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
import { Logger } from '../../infra/logger/Logger';
import { Application } from '../../app/app';

export class CliApi {
	private cli: Command;
	private helpCommand: HelpCommand;
	private logger: Logger;
	private app: Application;

	constructor(app: Application) {
		this.app = app;
		this.logger = new Logger('cli');
		this.logger.debug('Initializing CLI application...');

		this.cli = new Command()
			.name('stabelo-elevator')
			.description('Stabelo Elevator CLI')
			.version('1.0.0');

		// Register all commands which the CLI should be able to run
		this.helpCommand = new HelpCommand(); //store for later where we access it directly
		this.helpCommand.register(this.cli);

		// System commands
		(new HealthCommand(this.app)).register(this.cli);
		(new ExitCommand(this.app)).register(this.cli);

		// Elevator service commands
		(new AddRideCommand(this.app)).register(this.cli);
		(new ListElevatorsCommand(this.app)).register(this.cli);
		(new StatusCommand(this.app)).register(this.cli);
		(new ButtonsCommand(this.app)).register(this.cli);
		(new WatchCommand(this.app)).register(this.cli);
		(new InfoCommand(this.app)).register(this.cli);
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
			// In interactive mode, never exit - just return
			// Only exit on actual errors if not in keepAlive mode
			// Note: exit/quit commands call process.exit directly, bypassing this
			if (err.exitCode !== 0 && !keepAlive) {
				this.logger.error(`Exiting with code ${err.exitCode}`);
				process.exit(err.exitCode);
			}
			// Otherwise, just return and keep the process alive
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

				// Run the command, taking care to override the help command to prevent exit in interactive mode
				if (args[2] === 'help') {
					await this.helpCommand.runWithoutExiting(args);
				} else {
					await this.cli.parseAsync(args);
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

