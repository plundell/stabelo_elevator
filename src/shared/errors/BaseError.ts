/**
 * Represents an internal bug in the code which should never happen.
 * Captures comprehensive diagnostic information to aid in debugging.
 */
export class BaseError extends Error {
	public readonly timestamp: number = Date.now();


	constructor(message: string, public readonly context: Record<string, unknown> = {}, public readonly cause?: Error) {
		super(message);
		this.name = this.constructor.name; //works for all subclasses
	}

	get timestampISO(): string {
		return new Date(this.timestamp).toISOString(); //YYYY-MM-DDTHH:MM:SS.SSSZ
	}
	get time(): string {
		return new Date(this.timestamp).toLocaleTimeString(); //HH:MM:SS.SSS
	}

	/**
	 * Add things to the context of the error after it's been created.
	 * @param context - The context to update.
	 */
	updateContext(context: Record<string, unknown>): void {
		for (const [key, value] of Object.entries(context)) {
			this.context![key] = value;
		}
	}

	getContextLines(): string[] {
		const lines = [];
		if (this.context) {
			lines.push(``);
			lines.push(`Context:`);
			for (const [key, value] of Object.entries(this.context)) {
				lines.push(``);
				lines.push(`  ${key}:`);
				lines.push(...(JSON.stringify(value, null, 2).split('\n').map(line => ' '.repeat(4) + line)));
			}
		}
		return lines;
	}
	getCauseLines(): string[] {
		const lines = [];
		if (this.cause) {
			lines.push(``);
			lines.push(`Cause:`);
			lines.push(...(this.cause.toString().split('\n').map(line => ' '.repeat(4) + line)));
		}
		return lines;
	}
	getStackLines(): string[] {
		const lines = [''];
		if (this.stack) {
			lines.push(`Stack Trace:`);
			lines.push(...(this.stack.split('\n').map(line => ' '.repeat(4) + line)));
		} else {
			lines.push('-- No stack trace available --');
		}
		return lines;
	}

	/**
	 * Returns an array of indented lines containing all the info from this errora string containing.
	 * @param indent - Optional. The number of spaces to indent all the lines with.
	 */
	getLines(indent?: number): string[] {
		const lines = [
			...this.toString().split('\n'),
			...this.getContextLines(),
			...this.getCauseLines(),
			...this.getStackLines()
		];
		return indent ? lines.map(line => ' '.repeat(indent) + line) : lines;
	}

	/**
	 * A string containing of format: `[timestamp] error-name: message`.
	 */
	toString(): string {
		return `[${this.time}] ${this.name}: ${this.message}`;
	}

	/**
	 * Returns a JSON representation of the bug with all diagnostic information.
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			timestamp: this.timestamp,
			timestampISO: new Date(this.timestamp).toISOString(),
			context: this.context,
			cause: this.cause,
			stack: this.stack,
		};
	}



}