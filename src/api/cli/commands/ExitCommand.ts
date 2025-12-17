import { Command } from 'commander';
import { BaseCommand } from './CommandBase';
import { Application } from '../../../app/app';
import { Logger } from '../../../infra/logger/Logger';

export class ExitCommand extends BaseCommand {
	constructor(private readonly app: Application, logger?: Logger) {
		super(logger);
	}

	register(cli: Command): void {
		cli
			.command('exit')
			.alias('quit')
			.description('Exit the CLI')
			.action(() => {
				// Exit immediately - process.exit will clean up everything
				this.app.stop();
			});
	}
}

