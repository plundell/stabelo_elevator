/**
 * Our elevator is modeled as an event-driven discrete state machine. This class provides the IO of said 
 * state machine including:
 *  - Accept command to move up or down
 *  - Accept command to open and close doors
 *  - Emit signal when on events (simulating real-world sensors detecting it arriving at a floors and opening/closing doors)
 * 
 * @note The elevator can only accept commands when it's in the {@link ElevatorStateType.IDLE} state.
 */

import { TypedEventEmitter } from "../../infra/events/TypedEventEmitter";
import { Logger } from "../../infra/logger/Logger";
import { DistributiveOmit } from "../../shared/types/helpers";
import { BUGBUG } from "../../shared/errors/Bug";
import { Floor } from "../route/Floors";
import { ElevatorStateType, StateProps, StatesWithProp } from "./types";
import type { ElevatorEventMap, ElevatorStates } from "./types";
import type { AppOptions } from "../../options";

/**
 * Options required by the ElevatorIO class.
 */
export type ElevatorIOOptions = Pick<AppOptions, 'INITIAL_FLOOR' | 'TRAVEL_TIME_PER_FLOOR' | 'DOOR_OPEN_TIME'>;


type SettableState = DistributiveOmit<ElevatorStates, 'startTime'>;

/**
 * The ElevatorIO class is responsible for providing the IO of the elevator state machine.
 */
export class ElevatorIO extends TypedEventEmitter<ElevatorEventMap> {

	/**
	 * A timeout to schedule a future state change. This being set means the state machine
	 * is in between two points in time where new commands are accepted.
	 */
	private timeout?: NodeJS.Timeout;

	/**
	 * The current state of the elevator. 
	 * 
	 * Always set before state machine enters the "{@link timeout} period" so it can 
	 * always be queries with {@link getState()}.
	 * 
	 * Only changed by setter {@link setState()} which also the change as events.
	 */
	private state: ElevatorStates; //! = Initialized in constructor via setState()


	/**
	 * Initialize the ElevatorIO with the initial state. This should happen before the elevator is started.
	 * @param options - The options for the ElevatorIO.
	 * @param logger - The logger for the ElevatorIO.
	 */
	constructor(private readonly options: ElevatorIOOptions, logger?: Logger) {
		super(logger);
		//ugly workaround setting it here directly the first time
		this.state = { type: ElevatorStateType.IDLE, atFloor: options.INITIAL_FLOOR, startTime: Date.now() };
	}


	/**
	 * Set the current state of the elevator (which also emits it as an event)
	 * 
	 * @param state - The state to set. Must be a valid state type, but without the startTime property.
	 * 
	 * @example
	 * ```typescript
	 * this.setState({ type: ElevatorStateType.MOVING_UP, fromFloor: 1, toFloor: 2 });
	 * ```
	 */
	private setState<K extends ElevatorStateType>(state: Extract<SettableState, { type: K }>): void { //TODO: do we need extract here?
		const oldState = this.state;
		this.state = { ...state, startTime: Date.now() }
		// `\x1b[32m[${String(name)}]`
		this.logger?.debug(`\x1b[32mState changed from \x1b[33m${oldState.type}\x1b[32m to \x1b[38;5;208m${this.state.type}\x1b[32m\x1b[0m `);
		this.emit(this.state.type, { ...this.state });
		this.emit('change', { from: oldState, to: this.state }); //makes it easy to listen to all state changes
	}


	/**
	 * Get the current state of the elevator.
	 * @param property - The property to get.
	 * @returns The value of the property.
	 */
	getState(): ElevatorStates;
	getState<K extends StateProps>(property: K): StatesWithProp<K>[K];
	getState<K extends StateProps>(property?: K): StatesWithProp<K>[K] | ElevatorStates {
		if (property) {
			return (this.state as StatesWithProp<K>)[property];
		}
		return { ...this.state }; //Return a copy of the state to avoid mutability issues
	}


	/**
	 * Get the next floor at which the elevator can accept a command (i.e. the next floor at which the elevator
	 * will at some point be idle)
	 * 
	 * @returns A {@link Floor}
	 * @throws A {@link BUGBUG } if the state is such that no next floor can be determined.
	 */
	getNextFloorWhereElevatorAcceptsCommands(): Floor {
		const floor = this.getState('atFloor') ?? this.getState('toFloor');
		if (floor === undefined) {
			throw new BUGBUG('Both atFloor and toFloor are unset on ElevatorIO.state', { state: this.state });
		}
		return floor;
	}

	/**
	 * Schedule a future state change to the given state at a given delay.
	 * @param state - The state to change to.
	 * @param delay - The delay in milliseconds at which to change to the state.
	 * @param replaceExisting - Whether to replace an existing timeout if one exists.
	 */
	private setFutureState(state: SettableState, delay: number, replaceExisting = false): void {
		if (this.timeout) {
			this.logger?.warn(`Current state: ${JSON.stringify(this.state)}`);
			if (replaceExisting) {
				this.logger?.warn(`Cancelling existing timeout in favor of one which will set this state: ${JSON.stringify(state)}`);
				clearTimeout(this.timeout);
			} else {
				this.logger?.error(`A timeout is already scheduled and you havn't opted to replacing it, \
					so this state will never be set: ${JSON.stringify(state)}`);
				return;
			}
		}
		this.timeout = setTimeout(() => {
			this.timeout = undefined;
			this.setState(state);
		}, delay);
	}


	/**
	 * Schedule a future state change to the IDLE state at a given floor and time.
	 * @param floor - The floor to idle at.
	 * @param delay - The delay in milliseconds at which to idle at the floor.	
	 */
	private setFutureIdleAtFloor(floor: Floor, delay: number, replaceExisting = false): void {
		this.setFutureState({ type: ElevatorStateType.IDLE, atFloor: floor }, delay, replaceExisting);
	}

	/**
	 * Move the elevator by a given number of floors.
	 * 
	 * NOTE: We don't keep track of the total number of floors here, that should be handled before this is called.
	 * 
	 * @param n - The number of floors to move up or down.
	 */
	move(n: number): void {
		if (n === 0) {
			throw new Error('Cannot move by 0 floors');
		}
		const direction = n > 0 ? 'up' : 'down';
		if (this.state.type !== ElevatorStateType.IDLE) {
			throw new Error('Elevator is not idle, cannot move ' + direction);
		}

		//Change the state now to 'moving'...
		const toFloor = this.state.atFloor + n;
		const travelTime = this.options.TRAVEL_TIME_PER_FLOOR * Math.abs(n);
		const dueTime = Date.now() + travelTime;
		const type = direction === 'up' ? ElevatorStateType.MOVING_UP : ElevatorStateType.MOVING_DOWN;
		this.setState({ type, fromFloor: this.state.atFloor, toFloor, dueTime });

		//Schedule a future state change to 'idle' when it arrives at the new floor...
		this.setFutureIdleAtFloor(toFloor, travelTime);
	}


	/**
	 * Send a command to open the doors at the current floor.
	 * 
	 * NOTE: can only be called when this.state.type === ElevatorStateType.DOORS_OPEN || this.state.type === ElevatorStateType.IDLE
	 * 
	 */
	openDoors(): void {
		if (this.state.type !== ElevatorStateType.DOORS_OPEN && this.state.type !== ElevatorStateType.IDLE) {
			throw new Error('Elevator is not idle or doors are open, cannot open doors');
		}
		//Change the state now to 'doors open'. If they already are that will tell anyone listening that they're going to 
		//stay open for longer
		this.setState({ type: ElevatorStateType.DOORS_OPEN, atFloor: this.state.atFloor, dueTime: Date.now() + this.options.DOOR_OPEN_TIME });

		//Schedule a future state change to 'idle' when the doors are closed. If the doors are already open then there would
		//be an existing timeout which would be replaced by this one. (currently that will log a warning)
		this.setFutureIdleAtFloor(this.state.atFloor, this.options.DOOR_OPEN_TIME, true); //true = replace existing timeout
	}





}