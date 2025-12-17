import { ElevatorIO } from "./ElevatorIO";
import { ElevatorStateType, IdleState } from "./types";
import { ElevatorRoute } from "../route/ElevatorRoute";
import { Logger } from "../../infra/logger/Logger";
import { Strategy } from "../strategies/Strategy";
import { Floor, validateFloors } from "../route/Floors";
import type { AppOptions } from "../../options";
import type { ElevatorIOOptions } from "./ElevatorIO";
import { ExplicitAny } from "../../shared/types/helpers";

export type ElevatorOptions = Pick<AppOptions, 'MIN_FLOOR' | 'MAX_FLOOR'> & ElevatorIOOptions;
export type ElevatorId = string;


/**
 * A single elevator. Usually one of many in an {@link ElevatorService}. 
 * 
 * It's responsible for bringing 3 things together:
 *  - **IO** - reading the elevator's state (like which floor it's at and what it's doing) and sending commands to it
 *  - **Route** - an input-ordered and request-counted list of floors to visit
 *  - **Travel strategy** - a strategy to decide in which order floors should be visted
 * 
 * When rides are added to the elevator it will start moving automatically and events of state changes
 * will start being emitted.
 */
export class Elevator {
	public readonly route: ElevatorRoute;
	public readonly io: ElevatorIO;
	private _running_listener?: (...args: ExplicitAny[]) => void;

	constructor(
		public readonly id: ElevatorId
		, private readonly travelStrategy: Strategy
		, public readonly options: ElevatorOptions
		, public readonly logger?: Logger
	) {
		this.route = new ElevatorRoute();
		this.io = new ElevatorIO(options, logger);

	}

	/**
	 * Start the elevator.
	 * 
	 * This will connect to the IO which effectively "turns on" this state machine by which I mean
	 * any state changes will now trigger yet another action.
	 * 
	 * @param soft - If true, will not warn or throw an error if the elevator is already running.
	 */
	start(soft: boolean = false): void {
		if (this.isRunning()) {
			if (!soft) {
				this.logger?.warn('Elevator is already running');
			}
			return;
		}
		const listener = this.tellElevatorWhatToDoNext.bind(this);
		this.io.listen(ElevatorStateType.IDLE, listener);
		this._running_listener = listener;
	}

	/**
	 * Check if the elevator is running.
	 * @returns True if the elevator is running, false otherwise.
	 */
	isRunning(): boolean {
		if (this._running_listener) {
			return this.io.listeners(ElevatorStateType.IDLE).includes(this._running_listener);
		}
		return false;
	}

	/**
	 * Graceful shutdown handler. 
	 * 
	 * Currently this only only removes all listeners (internal and external) for state change events.
	 */
	shutdown(): void {
		this.io.removeAllListeners();
		this.route.removeAllListeners();
	}


	/**
	 * Tell the elevator what to do next. This handler can be called anytime the elevator is idle.
	 * @param state - The idle state.
	 */
	private tellElevatorWhatToDoNext(state: IdleState): void {
		try {
			//If we're at a floor we should stop at...
			if (this.route.shouldVisit(state.atFloor)) {
				// ...register the stop on the route...
				this.route.visitNow(state.atFloor);

				// ... and open the doors. When the doors close in the future it will trigger another IDLE event
				// which will cause this handler to run again.
				this.io.openDoors();
			} else {
				//If we're not at a floor we should stop at but there are still stops to visit...
				if (this.route.length() > 0) {
					//...then we let the strategy tell us how many floors to move
					this.io.move(this.travelStrategy.getNrFloorsToMove(this.route, state.atFloor));
				}
			}
		} catch (error) {
			this.logger?.error('Error telling elevator what to do next:', error);
		}
	}






	/**
	 * Add a floor as a stop to the elevator's route.
	 * @param floor - The floor to add as a stop.
	 * @throws RangeError if the floor is out of bounds.
	 */
	addRide(pickupFloor: Floor, dropoffFloor?: Floor): void {
		//First check we have (a) valid floor(s) within the bounds of the elevator. Do this even if the ElevatorService 
		//already has (defensive programming and all that)
		validateFloors(pickupFloor, dropoffFloor, this.options);


		//Check for veto again in case the strategy changed its mind. 
		if (this.checkIfRideIsVetoed(pickupFloor, dropoffFloor)) {
			this.logger?.warn(`Late veto of ride from ${pickupFloor} to ${dropoffFloor} by strategy '${this.travelStrategy.constructor.name}'`);
			return;
		}
		//All good! Let's add the ride to the route
		this.route.addRide(pickupFloor, dropoffFloor);

		//Then we have to start proceedings somehow. If the elevator is already doing things then
		//it'll naturally get to our new floor in due time, but if it's not it needs nudging...
		if (this.io.getState('type') === ElevatorStateType.IDLE) {
			this.tellElevatorWhatToDoNext(this.io.getState() as IdleState);
		}
	}





	/**
	 * Asynchronously estimate the time it will take to pickup a passenger and drop them off
	 * without blocking the event loop. 
	 * 
	 * @see {@link Strategy.estimatePickupDropoffTime()} which this function relays to.
	 * 
	 * @param pickupFloor - The floor to pickup the passenger from.
	 * @param dropoffFloor - Optional.The floor to drop the passenger off at.
	 * 
	 * @returns A Promise containing the estimated time in milliseconds which is less than
	 *  {@link AppOptions.ESTIMATION_LIMIT} or -1 if that limit was reached.
	 */
	async estimatePickupDropoffTime(pickupFloor: Floor, dropoffFloor?: Floor): Promise<number> {
		return this.travelStrategy.estimatePickupDropoffTime(
			this.route.copy()
			, this.io.getState('atFloor')
			, pickupFloor
			, dropoffFloor
		);
	}


	/**
	 * Check if the strategy employed by this elevator vetos this ride.
	 * @param pickupFloor - The floor to pickup the passenger from.
	 * @param dropoffFloor - The floor to drop the passenger off at.
	 * @returns True if the ride is vetoed which means this elevator *WILL NOT* accept the ride, false otherwise.
	 */
	checkIfRideIsVetoed(pickupFloor: number, dropoffFloor?: number): boolean {
		if (this.travelStrategy.checkIfRideIsVetoed)
			return this.travelStrategy.checkIfRideIsVetoed(
				this.route
				, this.io.getState('atFloor')
				, pickupFloor
				, dropoffFloor
			);
		return false;
	}

	/**
	 * Check if the elevator is free, i.e. it has no rides to complete and is idle.
	 * @returns True if the elevator is free, false otherwise.
	 */
	isFree(): boolean {
		return this.route.length() === 0 //no rides to complete
			&& this.io.getState('type') === ElevatorStateType.IDLE //elevator is idle...
		// && Date.now()-this.io.getState('startTime') > 100 //...and has been so for a tick so we're not catching it right 
	}


	/**
	 * Get the length of the elevator's route.
	 * @returns The length of the elevator's route.
	 */
	getRouteLength(): number {
		return this.route.length();
	}




}