import { Command } from 'commander';
import { BaseCommand } from './CommandBase';
import { Application } from '../../../app/app';

export class ExitCommand extends BaseCommand {
	constructor(private readonly app: Application) {
		super('ExitCommand');
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

