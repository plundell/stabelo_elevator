import { TimeoutError } from "../errors/DomainErrors";

/**
 * A DTO containing the health status of a component.
 */
export interface ComponentHealthDto {
	name: string;
	healthy: boolean;
	timestamp: number;
	message: string;
}

/**
 * A class which wraps around a function which checks the health of a specific
 * component, providing a consistent interface for health check services to use.
 */
export class ComponentHealthCheck {

	private lastStatus: ComponentHealthDto;

	/**
	 * Creates a new health check object which can be executed by a health check service do determine the health of a component.
	 * 
	 * @param name - The name of the health check.
	 * @param fn - Function which performs the health check. Should reject with error or string if unhealthy. Resolves with an optional info message if healthy.
	 * @param minInterval - The minimum interval between two executions of the health check.
	 * @param timeout - The timeout for the health check function.
	 */
	constructor(
		public readonly name: string
		, private readonly fn: () => string | undefined | Promise<string | undefined>
		, public readonly minIntervalMs: number = 0
		, public readonly timeoutMs: number = 1000
	) {
		this.lastStatus = { name: this.name, healthy: true, timestamp: 0, message: "Never run" };
	}

	public getLastStatus(): ComponentHealthDto {
		return this.lastStatus;
	}

	/**
	 * Calculates the time since this check was last run.
	 * @returns Time in milliseconds
	 */
	public timeSinceLastRun(): number {
		return Date.now() - this.getLastStatus().timestamp;
	}

	/**
	 * Checks if the minimum interval has passed since the last run.
	 * @returns True if the minimum interval has passed, false otherwise.
	 */
	public readyForNextRun(): boolean {
		return !this.minIntervalMs || this.timeSinceLastRun() > this.minIntervalMs;
	}

	/**
	 * Executes the health check callback. If a minimum interval is set and this is called too often, the last
	 * status will be reused until that minimum has passed (the timestamp in the returned status will show when
	 * the check was run).
	 * 
	 * @returns Promise<HealthStatusDto> -Resolves to the health status.
	 */
	async run(): Promise<ComponentHealthDto> {
		//Reuse the last status if enough time hasn't passed since the last run
		if (!this.readyForNextRun()) {
			return this.getLastStatus();
		}

		let healthy: boolean = false;
		let result;
		try {
			//Run the health check function and timeout if it takes too long
			result = await Promise.race([
				this.fn(),
				new Promise<undefined>((_, reject) => setTimeout(() => reject(new TimeoutError(this.timeoutMs)), this.timeoutMs))
			]);
			healthy = true;
		} catch (error) {
			result = error ?? "Unknown error";
		}

		let message = String(result); //Handles primitives, arrays and Errors
		if (message == '[object Object]') message = JSON.stringify(result); //Handles objects

		//Update the last status and then return it as the current status. 
		this.lastStatus = { name: this.name, healthy, timestamp: Date.now(), message };
		return this.lastStatus;
	}


}
