import { KeysOfUnion } from "../../shared/types/helpers";



export enum ElevatorStateType {
	MOVING_UP = 'movingUp',
	MOVING_DOWN = 'movingDown',
	DOORS_OPEN = 'doorsOpen',
	IDLE = 'idle',
}

type Started = { startTime: number };
type Due = { dueTime: number };
type Timed = Started & Due;
type Traveling = { fromFloor: number; toFloor: number }
type Stationary = { atFloor: number }

export type MovingUpState = Traveling & Timed & { type: ElevatorStateType.MOVING_UP }
export type MovingDownState = Traveling & Timed & { type: ElevatorStateType.MOVING_DOWN }
export type DoorsOpenState = Stationary & Timed & { type: ElevatorStateType.DOORS_OPEN }
export type IdleState = Stationary & Started & { type: ElevatorStateType.IDLE }

export type ElevatorStates =
	| MovingUpState
	| MovingDownState
	| DoorsOpenState
	| IdleState


/**
 * An event emitted on every state change. This is what external clients will want to listen to.
 */
export type ElevatorStateChangeEvent = { from: ElevatorStates; to: ElevatorStates }

/**
 * The event map for the ElevatorIO class. 
 * 
 * All states can be emitted as events using their type as the event key.
*/
export type ElevatorEventMap = {
	[S in ElevatorStates as S["type"]]: Extract<ElevatorStates, { type: S["type"] }>
} & {
	change: ElevatorStateChangeEvent
};


export type StateProps = KeysOfUnion<ElevatorStates> //any prop in any state
export type StatesWithProp<K extends StateProps> = Extract<ElevatorStates, Record<K, unknown>> //subset of states which have specific prop
