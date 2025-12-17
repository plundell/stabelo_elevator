import { ElevatorId } from "../elevator/Elevator";
import { ElevatorStates } from "../elevator/types";
import { ElevatorStateChangeEvent } from "../elevator/types";
import { ButtonActiveEvent } from "../route/ElevatorRoute";

export const AVAILABILITY_EVENT = Symbol('availability');

/**
 * The event map for the ElevatorService class.  
*/
export type ElevatorServiceEventMap = {
	availability: ElevatorAvailabilityEvent
	state: AggregatedElevatorStateChangeEvents
	buttons: ButtonActiveEvent
	// [S in ElevatorAvailabilityEvent as S["type"]]: Extract<ElevatorAvailabilityEvent, { type: S["type"] }>
} & {
	[key: string]: ElevatorStateChangeEvent
}

/**
 * {@link ElevatorStateChangeEvent} which have been grouped into one stream and thus contain the elevator id.
 */
export type AggregatedElevatorStateChangeEvents = ElevatorStateChangeEvent & { elevator: ElevatorId }

/**
 * {@link ButtonActiveEvent} which have been grouped into one stream and thus contain the elevator id.
 */
export type AggregatedButtonActiveEvents = ButtonActiveEvent & { elevator: ElevatorId }

/**
 * Event emitted when an elevator is added to the service.
 */
export type ElevatorAddedEvent = { type: 'added', elevator: ElevatorId, state: ElevatorStates }

/**
 * Event emitted when an elevator is removed from the service.
 */
export type ElevatorRemovedEvent = { type: 'removed', elevator: ElevatorId }

/**
 * Event emitted when an elevator is added or removed from the service.
 */
export type ElevatorAvailabilityEvent = ElevatorAddedEvent | ElevatorRemovedEvent
