import { ElevatorStateType as S } from "../elevator/types";
import { DomainError } from "./DomainErrors";


/**
 * Common base class for all state-related errors.
 */
export class StateError extends DomainError { }


/**
 * Thrown when attempting to transition from one state to another in a way that is not allowed
 * by the state machine's rules (e.g., trying to move an elevator that is already moving).
 */
export class InvalidStateTransitionError extends StateError {
	constructor(states: { expected: S, was: S, target: S }, message?: string, context?: Record<string, unknown>, cause?: Error) {
		let msg = `Expected state ${states.expected} in order to transition to ${states.target}, but state was ${states.was}`;
		if (message) {
			msg += `: ${message}`;
		}
		super(msg, context, cause);
	}
}




