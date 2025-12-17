import { BaseError } from "../../shared/errors/BaseError";

/**
 * Common base class for all domain-related errors, which are all errors emitted anywhere in the domain.
 */
export class DomainError extends BaseError { }


/**
 * Thrown when a timeout occurs.
 */
export class TimeoutError extends DomainError {
	constructor(public readonly timeout: number, message?: string, context?: Record<string, unknown>, cause?: Error) {
		super(message ?? `Timeout after ${timeout}ms at ${new Date().toISOString()}`, context, cause);
	}
}
