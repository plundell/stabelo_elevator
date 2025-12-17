import { Command } from 'commander';

export class HelpCommand {
	private program!: Command;
	private originalHelp?: typeof Command.prototype.help;
	private originalCmdHelps?: Map<Command, typeof Command.prototype.help>;
	private readonly errMessage: string = 'help displayed';

	register(program: Command): void {
		this.program = program;
		program
			.command('help')
			.description('Display help for commands')
			.argument('[command]', 'Command to show help for')
			.action((commandName?: string) => {
				if (commandName) {
					// Help for specific command: "help health"
					const command = this.program.commands.find(cmd => cmd.name() === commandName);
					if (command) {
						command.outputHelp();
					} else {
						console.log(`Command "${commandName}" not found.`);
						this.program.outputHelp();
					}
				} else {
					// General help
					this.program.outputHelp();
				}
			});
	}

	/**
	 * By default Commander.js will exit the process after running help(), this overrides that behavior 
	 * by running the outputHelp() method instead then throwing an error. That error can be caught and
	 * execution can continue.
	 */
	setupHelpOverride(): void {
		// Store original help methods
		this.originalHelp = this.program.help.bind(this.program);
		this.originalCmdHelps = new Map<Command, typeof Command.prototype.help>();

		// Override help to prevent exit in interactive mode
		this.program.help = (() => {
			this.program.outputHelp();
			throw new Error(this.errMessage);
		}) as typeof this.program.help;

		// Override help for all subcommands to prevent exit
		this.program.commands.forEach(cmd => {
			this.originalCmdHelps!.set(cmd, cmd.help.bind(cmd));
			cmd.help = (() => {
				cmd.outputHelp();
				throw new Error(this.errMessage);
			}) as typeof cmd.help;
		});
	}

	restoreHelpOverride(): void {
		// Restore original help methods
		if (this.originalHelp) {
			this.program.help = this.originalHelp;
		}
		if (this.originalCmdHelps) {
			this.originalCmdHelps.forEach((originalCmdHelp, cmd) => {
				cmd.help = originalCmdHelp;
			});
		}
	}


	async runWithoutExiting(args: string[]): Promise<void> {
		// Setup help override to prevent exit in interactive mode
		this.setupHelpOverride();

		let err: any = null
		try {
			await this.program.parseAsync(args);
		} catch (error: any) {
			// Ignore help display errors - they're expected
			err = error;
		} finally {
			// Restore original help methods 
			this.restoreHelpOverride();
		}
		//Unless it's the expected error which is the key mechanism to prevent exit in interactive mode, rethrow it
		if (err && err.message !== this.errMessage) {
			throw err;
		}
	}
}

