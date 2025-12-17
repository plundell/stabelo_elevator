import { BaseError } from "./BaseError";
/**
 * Represents an internal bug in the code which should never happen.
 * Captures comprehensive diagnostic information to aid in debugging.
*/
export class BUGBUG extends BaseError {
	public readonly nodeVersion: string;
	public readonly platform: string;
	public readonly processId: number;
	public readonly memoryUsage: NodeJS.MemoryUsage;

	constructor(...args: ConstructorParameters<typeof BaseError>) {
		super(...args);
		this.nodeVersion = process.version;
		this.platform = process.platform;
		this.processId = process.pid;
		this.memoryUsage = process.memoryUsage();

		// Ensure stack trace is captured (which is usually done, but just in case)
		Error.captureStackTrace(this, BUGBUG);
	}

	private getMemoryUsageLines(): string[] {
		const lines = [
			`RSS: ${BUGBUG.toMB(this.memoryUsage.rss)}`,
			`Heap Total: ${BUGBUG.toMB(this.memoryUsage.heapTotal)}`,
			`Heap Used: ${BUGBUG.toMB(this.memoryUsage.heapUsed)}`,
			`External: ${BUGBUG.toMB(this.memoryUsage.external)}`
		].map(line => ' '.repeat(2) + line);
		return ['', `Memory Usage:`, ...lines];
	}

	/**
	 * Returns a list of lines containing the diagnostic information.
	 */
	getDiagnosticLines(): string[] {
		const lines = [
			`Timestamp: ${new Date(this.timestamp).toISOString()}`,
			`Node Version: ${this.nodeVersion}`,
			`Platform: ${this.platform}`,
			`Process ID: ${this.processId}`,
			...this.getMemoryUsageLines(),
		].map(line => ' '.repeat(2) + line);
		return [``, `Diagnostic Information:`, ...lines];
	}


	/**
	 * Returns an array of indented lines containing all the info from this errora string containing.
	 * @param indent - Optional. The number of spaces to indent all the lines with.
	*/
	getLines(indent?: number): string[] {
		const lines = [
			...super.getLines(),
			...this.getDiagnosticLines(),
		];
		return indent ? lines.map(line => ' '.repeat(indent) + line) : lines;
	}


	/**
	 * Returns a JSON representation of the bug with all diagnostic information.
	 */
	toJSON(): Record<string, unknown> {
		return {
			...super.toJSON(),
			nodeVersion: this.nodeVersion,
			platform: this.platform,
			processId: this.processId,
			memoryUsage: this.memoryUsage,

		};
	}


	static toMB(bytes: number): string {
		return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
	}
}