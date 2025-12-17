import { TypedEventEmitter } from "../../infra/events/TypedEventEmitter";
import type { Logger } from "../../infra/logger/Logger";
import { type AppOptions } from "../../options";
import { BUGBUG } from "../../shared/errors/Bug";
import { Elevator, type ElevatorId } from "../elevator/Elevator";
import { ElevatorStateChangeEvent, ElevatorStates } from "../elevator/types";
import { DomainError } from "../errors/DomainErrors";
import { validateFloors, type Floor } from "../route/Floors";
import { ElevatorServiceEventMap } from "./types";

/**
 * This domain service is responsible for coordinating multiple elevators.
 * 
 * It's responsible for:
 * - Deciding which elevator to use for a ride
 * - Relaying the ride to the chosen elevator
 */
export class ElevatorService extends TypedEventEmitter<ElevatorServiceEventMap> {
	private readonly elevators: Map<ElevatorId, Elevator> = new Map();

	constructor(
		public readonly options: AppOptions
		, public readonly logger?: Logger) {
		super(logger);
	}

	/**
	 * Start the elevator service and all its elevators.
	 */
	start(): void {
		this.logger?.debug('Starting elevator service...');
		for (const elevator of this.elevators.values()) {
			this.logger?.debug(`Starting elevator ${elevator.id}...`);
			elevator.start(true);
		}
		this.logger?.debug('Elevator service started successfully');
	}

	/**
	 * Shutdown the elevator service and all its elevators.
	 */
	shutdown(): void {
		this.logger?.debug('Shutting down elevator service...');
		for (const elevator of this.elevators.values()) {
			this.logger?.debug(`Shutting down elevator ${elevator.id}...`);
			elevator.shutdown();
		}
		this.logger?.debug('Elevator service shut down successfully');
	}

	/**
	 * Check if the elevator service is running.
	 * NOTE: Not great complexity, but since hopefully all are either started or stopped it'll
	 * just have to look at the first one.
	 * @returns True if all elevators are running, false otherwise.
	 */
	isRunning(): boolean {
		for (const elevator of this.elevators.values()) {
			if (!elevator.isRunning()) {
				return false;
			}
		}
		return true;
	}


	/**
	 * Add an elevator to the service.
	 * @param elevator - The elevator to add.
	 * @throws DomainError if an elevator already exists.
	 */
	addElevator(elevator: Elevator): void {
		if (this.elevators.has(elevator.id)) {
			const existing = this.elevators.get(elevator.id)!;
			if (elevator === existing) {
				this.logger?.warn(`Elevator ${elevator.id} already exists. Ignoring this call`);
				return;
			} else {
				throw new DomainError(`Elevator with same already exists, but it's not the same object.`, { elevator, existing });
			}
		}
		//Store the elevator in the service
		//TODO: we might need a more specific id to make sure it doesn't clash with other events below
		this.elevators.set(elevator.id, elevator);


		//Start the elevator
		if (!this.isRunning()) {
			elevator.start(true);
		}

		//Notify listeners that a new elevator has been added to the service
		this.emit('availability', { type: 'added', elevator: elevator.id, state: elevator.io.getState() });

		//Re-emit state changes from the elevator to the service's aggregated stream of state changes
		//and as individual streams
		elevator.io.listen('change', (event: ElevatorStateChangeEvent) => {
			this.emit(elevator.id, event)
			this.emit('state', { ...event, elevator: elevator.id });
		});
	}

	removeElevator(x: Elevator | ElevatorId): void {
		const id = x instanceof Elevator ? x.id : x;
		if (!this.elevators.has(id)) {
			this.logger?.warn(`Elevator ${id} does not exist, cannot remove`);
		} else {
			const elevator = this.elevators.get(id)!;
			elevator.shutdown(); //this will stop the service receiving any more state changes
			this.elevators.delete(id); //remove from service
			this.removeAllListeners(id); //remove downstream listeners
			this.emit('availability', { type: 'removed', elevator: elevator.id });
		}
	}

	/**
	 * List the ids of all elevators in the service.
	 * @returns An array of elevator ids.
	 */
	listElevators(): ElevatorId[] {
		return [...this.elevators.keys()];
	}

	private getElevator(id: ElevatorId): Elevator {
		const elevator = this.elevators.get(id);
		if (!elevator) {
			throw new DomainError(`Elevator ${id} not found`);
		}
		return elevator;
	}

	/**
	 * Get the current state of an elevator.
	 * @param id - The id of the elevator to get the state of.
	 * @returns The current state of the elevator.
	 * @throws A {@link DomainError} if the elevator does not exist.
	 */
	getElevatorState(id: ElevatorId): ElevatorStates {
		return this.getElevator(id).io.getState();
	}

	/**
	 * Get the current state of all elevators in the service.
	 * @returns An object with the elevator id as the key and the state as the value.
	 */
	getAllElevatorStates(): Record<ElevatorId, ElevatorStates> {
		const states: Record<ElevatorId, ElevatorStates> = {};
		for (const elevator of this.elevators.values()) {
			states[elevator.id] = elevator.io.getState();
		}
		return states;
	}

	/**
	 * Get the pushed buttons for an elevator.
	 * @param id - The id of the elevator to get the pushed buttons for.
	 * @returns An array of floors which have been pushed as buttons.
	 * @throws A {@link DomainError} if the elevator does not exist.
	 */
	getPushedButtons(id: ElevatorId): Floor[] {
		return this.getElevator(id).route.getPushedButtons();
	}

	/**
	 * Get the pushed buttons for all elevators in the service.
	 * @returns An object with the elevator id as the key and the pushed buttons as the value.
	 */
	getAllPushedButtons(): Record<ElevatorId, Floor[]> {
		const buttons: Record<ElevatorId, Floor[]> = {};
		for (const elevator of this.elevators.values()) {
			buttons[elevator.id] = elevator.route.getPushedButtons();
		}
		return buttons;
	}

	/**
	 * Add a ride to one of the elevators co-ordinated by this service.
	 * @param pickupFloor - The floor to pickup the passenger from.
	 * @param dropoffFloor - The floor to drop off the passenger at.
	 * @returns Promise containing the id of the elevator that will be used to complete the ride
	 * @throws A {@link DomainError} if no elevator can be found to complete the ride
	 */
	async addRide(pickupFloor: Floor, dropoffFloor?: Floor): Promise<ElevatorId> {
		//First check we have (a) valid floor(s) within the bounds of the elevator. 
		validateFloors(pickupFloor, dropoffFloor, this.options);
		const rideStr = (dropoffFloor !== undefined) ? `ride from ${pickupFloor} to ${dropoffFloor}` : `pickup at ${pickupFloor}`;

		//We start by checking which elevators won't veto this ride
		const elevators = [...this.elevators.values()]
			.filter(elevator => elevator.checkIfRideIsVetoed(pickupFloor, dropoffFloor) == false);
		if (elevators.length === 0) {
			throw new DomainError(`All elevators vetoed ${rideStr}`);
		}

		// If we've opted to use up all the free elevators first...
		if (this.options.USE_FREE_FIRST) {
			const elevator = elevators.find(elevator => elevator.isFree());
			if (elevator) {
				elevator.addRide(pickupFloor, dropoffFloor);
				this.logger?.debug(`Added ${rideStr} to elevator ${elevator.id}`);
				return elevator.id;
			} else {
				this.logger?.debug(`No free elevator found for ${rideStr}`);
			}
		}

		//Next we ask all elevators how long it would take to complete the ride. Note: This won't block 
		//the event loop even at scale, see Strategy.estimatePickupDropoffTime() for details.
		const estimates = (await Promise.all(
			elevators.map(elevator => elevator.estimatePickupDropoffTime(pickupFloor, dropoffFloor))
		)).map((estimate, i) => ({ elevator: elevators[i], estimate }));

		//If one or more provide a number >-1 we go with the smallest one - that will be the elevator
		//who can complete the ride the fastest, either because it's close, or because it's got less
		//stops to visit, or because some other logic which the strategy implements which means it'll
		//take less time for that particular ride.
		const shortestWait = estimates.filter(({ estimate }) => estimate > -1).sort((a, b) => a.estimate - b.estimate)?.at(0);
		if (shortestWait) {
			this.logger?.debug(`Added ${rideStr} to elevator ${shortestWait.elevator.id} who estimated ${shortestWait.estimate}ms`);
			shortestWait.elevator.addRide(pickupFloor, dropoffFloor);
			return shortestWait.elevator.id;
		}

		//If we're still running that means all the elevators estimated rides longer than 
		//AppOptions.estimationLimit which by design means we'll simply add it to the elevator 
		//which has the shortest route planned.
		const shortestRoute = elevators
			.map(elevator => ({ elevator, length: elevator.getRouteLength() }))
			.sort((a, b) => a.length - b.length)?.at(0);
		if (shortestRoute) {
			shortestRoute.elevator.addRide(pickupFloor, dropoffFloor);
			this.logger?.debug(`Added ${rideStr} to elevator ${shortestRoute.elevator.id} who has the shortest route planned`);
			return shortestRoute.elevator.id;
		} else {
			throw new BUGBUG(`It shouldn't be logically possible for this array of elevators to be empty:`, { elevators })
		}

	}
}