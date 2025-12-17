import { Command } from 'commander';
import { Application } from '../../../app/app';
import { BaseCommand } from './CommandBase';
import { Logger } from '../../../infra/logger/Logger';

export class HealthCommand extends BaseCommand {

	constructor(private readonly app: Application, logger?: Logger) {
		super(logger);
	}

	register(program: Command): void {
		program
			.command('health')
			.description('Check the health status of the service')
			.option('-p, --pretty', 'Output in human-readable format (default: JSON)')
			.action((options) => {
				this.execute(options);
			});
	}

	private execute(options: { pretty?: boolean }): void {
		try {
			const { healthyComponents, unhealthyComponents } = this.app.healthService.getSystemHealth();

			if (options.pretty) {
				healthyComponents.forEach(component => {
					this.logger.info(`  ${component.name}: ${component.healthy ? 'Healthy' : 'Unhealthy'}`);
				});
				unhealthyComponents.forEach(component => {
					this.logger.warn(`  ${component.name}: ${component.healthy ? 'Healthy' : 'Unhealthy'}`);
				});
			} else {
				console.log(JSON.stringify({ healthyComponents, unhealthyComponents }, null, 2));
			}
		} catch (error) {
			this.logger.error('Health check failed:', error instanceof Error ? error.message : 'Unknown error');
		}
	}

}

