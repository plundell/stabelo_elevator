import { DomainError } from "./DomainErrors";

/**
 * Common base class for all validation-related errors.
 */
export class ValidationError extends DomainError {
	public readonly value: unknown;
	constructor(value: unknown, message: string, context?: Record<string, unknown>, cause?: Error) {
		super(message, context, cause);
		this.value = value;
	}
}


export class InvalidFloorError extends ValidationError {
	constructor(floor: unknown, cause: Error, argName?: string, context?: Record<string, unknown>) {
		const message = `Invalid ${argName ?? 'floor'}: ${floor}. ${cause.message}`;
		super(floor, message, context, cause);
	}
}