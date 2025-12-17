import { ComponentHealthCheck, ComponentHealthDto } from '../../domain/health/ComponentHealthCheck';
import { TypedEventEmitter } from "../../infra/events/TypedEventEmitter";
import { Logger } from '../../infra/logger/Logger';

/**
 * The default interval between health checks in milliseconds.
 */
const DEFAULT_CHECK_INTERVAL_MS = 10000;

/**
 * A DTO containing the health status of the system, split by healthy and unhealthy components.
 */
export interface SystemHealthDto {
	healthyComponents: ComponentHealthDto[];
	unhealthyComponents: ComponentHealthDto[];
}


/**
 * A map of events and their single argument emitted by the {@link HealthService}.
 */
export type HealthServiceEventMap = {
	broken: ComponentHealthDto;
	recovered: ComponentHealthDto;
	healthy: SystemHealthDto;
	unhealthy: SystemHealthDto;
};




export class HealthService extends TypedEventEmitter<HealthServiceEventMap> {
	private checks: ComponentHealthCheck[] = [];
	private intervalId: NodeJS.Timeout | undefined;
	private lastStatuses: Map<string, ComponentHealthDto> = new Map();

	constructor(private readonly checkIntervalMs: number = DEFAULT_CHECK_INTERVAL_MS, logger?: Logger) {
		super(logger);
	}

	public start(): void {
		if (!this.intervalId) {
			this.logger?.debug('Starting health check service...');
			this.intervalId = setInterval(this.runChecks.bind(this), this.checkIntervalMs);
			//Run once right away
			this.runChecks();
		}
	}

	public shutdown(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
			this.logger?.info('Health check service stopped');
		}
	}

	public registerCheck(check: ComponentHealthCheck): void {
		this.checks.push(check);
	}


	/**
	 * Checks if the system is healthy by checking the last health status from each registered check.
	 * @returns True if every component is healthy, false otherwise.
	 */
	public isHealthy(): boolean {
		for (const status of this.lastStatuses.values()) {
			if (!status.healthy) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Get the latest check results for each component, split by healthy and unhealthy.
	 */
	public getSystemHealth(): SystemHealthDto {
		const systemHealth: SystemHealthDto = {
			healthyComponents: [],
			unhealthyComponents: [],
		};
		for (const status of this.lastStatuses.values()) {
			if (status.healthy) {
				systemHealth.healthyComponents.push(status);
			} else {
				systemHealth.unhealthyComponents.push(status);
			}
		}
		return systemHealth;
	}


	/**
	 * Runs all checks currently registered, emitting events for changes in health of individual components and the
	 * system as a whole.
	 * 
	 * This method is called by the check loop at the specified interval.
	 * 
	 * @returns Promise<void> - Resolves when all checks have finished.
	 */
	private async runChecks(): Promise<void> {

		let healthyBefore = this.isHealthy();
		this.logger?.debug('Running health checks...');
		//Run all checks in parallel, emitting events for each which may have 'broken' or 'recovered'
		await Promise.all(this.checks.map(check =>
			check.run()
				.then(result => {
					//If the healthy status has changed since the last check, emit an event
					const last = this.lastStatuses.get(result.name);
					if (last !== result && result.healthy !== last?.healthy && (last || !result.healthy)) {
						this.emit(result.healthy ? 'recovered' : 'broken', result);
						this.logger?.log(result.healthy ? 'info' : 'warn', `Component '${result.name}' ${result.healthy ? 'recovered!' : 'broke!'}`);
					}
					//Store as the latest status
					this.lastStatuses.set(result.name, result);
				})
		))

		//Now all checks have finished, so we compare the overall health to the last overall health
		const healthyAfter = this.isHealthy();
		if (healthyBefore !== healthyAfter) {
			this.emit(healthyAfter ? 'healthy' : 'unhealthy', this.getSystemHealth());
			this.logger?.log(healthyAfter ? 'info' : 'warn', `The system is now ${healthyAfter ? 'healthy' : 'unhealthy'}!`);
		}
	}

}

