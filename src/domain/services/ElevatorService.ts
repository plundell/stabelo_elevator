import type { Logger } from "../../infra/logger/Logger";
import { type AppOptions } from "../../options";
import { BUGBUG } from "../../shared/errors/Bug";
import { Elevator, type ElevatorId } from "../elevator/Elevator";
import { DomainError } from "../errors/DomainErrors";
import { validateFloors, type Floor } from "../route/Floors";

/**
 * This domain service is responsible for coordinating multiple elevators.
 * 
 * It's responsible for:
 * - Deciding which elevator to use for a ride
 * - Relaying the ride to the chosen elevator
 */
export class ElevatorService {

	constructor(
		private readonly elevators: Elevator[]
		, public readonly options: AppOptions
		, public readonly logger?: Logger) {

	}

	/**
	 * Add a ride to one of the elevators co-ordinated by this service.
	 * @param pickupFloor 
	 * @param dropoffFloor 
	 * @returns Promise containing the id of the elevator that will be used to complete the ride
	 * @throws An error if no elevator can be found to complete the ride
	 */
	async addRide(pickupFloor: Floor, dropoffFloor?: Floor): Promise<ElevatorId> {
		//First check we have (a) valid floor(s) within the bounds of the elevator. 
		validateFloors(pickupFloor, dropoffFloor, this.options);
		const rideStr = (dropoffFloor !== undefined) ? `ride from ${pickupFloor} to ${dropoffFloor}` : `pickup at ${pickupFloor}`;

		//We start by checking which elevators won't veto this ride
		const elevators = this.elevators.filter(elevator => elevator.checkIfRideIsVetoed(pickupFloor, dropoffFloor) == false);
		if (elevators.length === 0) {
			throw new DomainError(`All elevators vetoed ${rideStr}`);
		}
		// If we've opted to use up all the free elevators first...
		if (this.options.USE_FREE_FIRST) {
			const elevator = this.elevators.find(elevator => elevator.isFree());
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