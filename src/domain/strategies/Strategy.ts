import type { ElevatorRoute } from "../route/ElevatorRoute";
import type { Logger } from "../../infra/logger/Logger";
import type { AppOptions } from "../../options";
import type { Floor } from "../route/Floors";
import { BUGBUG } from "../../shared/errors/Bug";

/**
 * Options required by the Strategy class.
 */
export type StrategyOptions = Pick<AppOptions,
	'TRAVEL_TIME_PER_FLOOR'
	| 'DOOR_OPEN_TIME'
	| 'ESTIMATION_LIMIT'
>;


/**
 * An array of floors to stop at in order
 */
export type OrderedStops = Array<Floor>;

/**
 * An optional callback passed to {@link getOrderedStops()} which should be called for every
 * stop added to the list to allow stopping the traversal early. This is currently used to 
 * implment {@link AppOptions.ESTIMATION_LIMIT}.
 * 
 * @param lastStop - The stop added to the list most recently
 * @param stops - The entire list of stops so far
 * 
 * @returns True if the traversal should be stopped early, falsey otherwise.
 */
export type StopEarly = (lastStop: Floor, stops: OrderedStops) => boolean;

/**
 * An abstract base class for all strategies which contains common functionality.
 */
export abstract class Strategy {

	/**
	 * @param options - A subset of {@link AppOptions} required by the strategy. See {@link StrategyOptions}.
	 * @param logger - The logger for the strategy.
	 */
	constructor(public readonly options: StrategyOptions, public readonly logger?: Logger) { }

	//TODO: If StopEarly is provided we shouldn't return the stops since the callback could be used to grab the output and
	//that way we don't allocate extra memory if not needed.
	/**
	 * Apply the strategy to a route to get an ordered list of stops.
	 * 
	 * NOTE: This will consume the passed in route, i.e. it will be altered!
	 * 
	 * @param route - The route to consume. **This will be altered!**
	 * @param currentFloor - The floor the elevator is currently at, i.e. before the route is started.
	 * @param targetFloor - Optional. Stop traversal when this floor is reached. The stop happens after it's been visited, ie.
	 *                      it will have been removed from the `route` and added to the returned list of stops.
	 * @param stopEarly - Optional. A callback to stop the traversal early.
	 * @returns A {@link OrderedStops} of floors to stop at in order.
	 */
	abstract getOrderedStops(route: ElevatorRoute, currentFloor: Floor, targetFloor?: Floor, stopEarly?: StopEarly): OrderedStops;


	/**
	 * Run getOrderedStops() in batches which yields the thread back to the event loop inbetween batches,
	 * good when running this on multiple Elevators at the same time to avoid the system becoming unresponsive.
	 * 
	 * @see {@link getOrderedStops()} for details on the parameters.
	 */
	async batchedGetOrderedStops(route: ElevatorRoute, currentFloor: Floor, targetFloor?: Floor, stopEarly?: StopEarly): Promise<OrderedStops> {
		const batchSize = 10; //we're just choosing a number here instead of making it an option.

		//For single batch runs just skip this function 
		if (route.length() <= batchSize) {
			return this.getOrderedStops(route, currentFloor, targetFloor, stopEarly);
		}

		//We wrap the stop-early callback in order to...
		const stops: OrderedStops = [];
		let n = 0;
		let done = false;
		const wrappedStopEarly: StopEarly = (nextStop, _) => {
			currentFloor = nextStop; //...keep track of where we are when we start the next batch && to check when we're done
			stops.push(nextStop); //...get all the output from all the batches
			if (++n >= batchSize) {
				n = 0; //reset for next batch
				return true; //...break when we hit the batch size
			}
			//After we've done our thing we call, possibly, the original stop-early so we 
			// don't break anything. We also pass our stops array since it contains 
			// all the stops, not just the one from the current batch.
			if (stopEarly?.(nextStop, stops) ?? false) {
				done = true; //they want us to stop, so we don't try for another batch below.
				return true;
			}
			return false;
		};
		//Now we loop, one batch at a time, until the passed in stopEarly says we're done, or until
		// we've found the target floor, or until the route is empty.
		let iterationCount = 0;
		while (!done && currentFloor !== targetFloor && route.length() > 0) {
			//On every loop we yield the thread to the event loop - this is the whole point of this function
			await new Promise(resolve => setImmediate(resolve));
			this.getOrderedStops(route, currentFloor, targetFloor, wrappedStopEarly);

			const tail = stops.slice(-10);
			if (tail.length > 1 && tail.every(stop => stop === currentFloor) || ++iterationCount > 10000) {
				throw new BUGBUG('Infinite loop!', { currentFloor, iterationCount, stops, route });
			}
		}
		return stops;
	}





	/**
	 * Estimate the time it will take to pickup a passenger and optionally drop them off. This will run
	 * the batched version of {@link getOrderedStops()} to avoid blocking the event loop.
	 * 
	 * @param routeCopy - The route to estimate based on. This will be copied and thus **NOT** altered!
	 * @param currentFloor - The floor the elevator is currently at, i.e. before the route is started.
	 * @param pickupFloor - The floor to pickup the passenger from.
	 * @param dropoffFloor - Optional. The floor to drop the passenger off at.
	 * 
	 * @returns The estimated time in milliseconds if less than {@link AppOptions.ESTIMATION_LIMIT}, else -1.
	 */
	async estimatePickupDropoffTime(routeCopy: ElevatorRoute, currentFloor: Floor, pickupFloor: Floor, dropoffFloor?: Floor): Promise<number> {

		//Create a stop-early callback which we can pass along below in order to 
		//stop the estimation when we reach the estimation limit.
		let estimatedTime = 0;
		let last = currentFloor;
		const stopEarly: StopEarly = (curr, _) => {
			estimatedTime += this.options.DOOR_OPEN_TIME;
			estimatedTime += Math.abs(curr - last) * this.options.TRAVEL_TIME_PER_FLOOR
			last = curr;
			return estimatedTime > this.options.ESTIMATION_LIMIT;
		};

		//Now run the first part of the journey, i.e. the pickup. If we're already at the pickup floor 
		//then we we just add a doorOpenTime and move on. If we hadn't, since 
		if (currentFloor === pickupFloor) {
			estimatedTime += this.options.DOOR_OPEN_TIME;
		} else {
			await this.batchedGetOrderedStops(routeCopy, currentFloor, pickupFloor, stopEarly);
		}


		//If a dropoff was specified, and if we havn't run into the limit, we now run it again. Note that we
		// pass in the now-altered routeCopy which has been fast-forwarded to the pickup floor.
		if (dropoffFloor && estimatedTime < this.options.ESTIMATION_LIMIT) {
			await this.batchedGetOrderedStops(routeCopy, pickupFloor, dropoffFloor, stopEarly);
		}

		//Now we're done. If the estimate is less than the limit, return it, otherwise return -1.
		return estimatedTime < this.options.ESTIMATION_LIMIT ? estimatedTime : -1;
	}



	/**
	 * Get the number of floors to move either up or down
	 * @param route - A route which will **NOT** be altered.
	 * @param currentFloor - The floor the elevator is currently at, i.e. before the route is started.
	 * @returns The number of floors to move, positive for up, negative for down.
	 */
	abstract getNrFloorsToMove(route: ElevatorRoute, currentFloor: Floor): number;


	/**
	 * Before being asked to estimate travel time this method should be called to check if the strategy
	 * would like to veto accepting this ride. Useful in special cases where we for example have different 
	 * strategies for different elevators and want some elevators to only service certain floors/paths
	 * 
	 * @param route - The existing {@link ElevatorRoute} for the elevator 
	 * @param startFloor - The floor the elevator is currently at, i.e. before the route is started.
	 * @param pickupFloor - The floor to pickup the passenger from.
	 * @param dropoffFloor - Optional.The floor to drop the passenger off at.
	 * 
	 * @returns True if the elevator should VETO the ride. False == consider accepting the ride.
	 * @overrideable Child classes should override this method if they want to implement vetoing.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	checkIfRideIsVetoed: null | ((route: ElevatorRoute, startFloor: Floor, pickupFloor: Floor, dropoffFloor?: Floor) => boolean) = null;

	/**
	 * Get the next floor in the route. Used internally by {@link getNrFloorsToMove()}.
	 * @param route - The route which should NOT be consumed
	 * @param currentFloor - The floor the elevator is currently at, i.e. before the route is started.
	 * @returns The next floor in the route, or 0 if the route is empty or the next floor is the same as the current floor.
	 */
	protected getNextFloor(route: ElevatorRoute, currentFloor: Floor): number | null {
		const nextFloor = route.first();
		if (nextFloor === undefined || nextFloor === currentFloor) {
			if (nextFloor === undefined) {
				this.logger?.warn('Route is empty');
			} else {
				this.logger?.warn('Next floor is the same as the current floor');
			}
			this.logger?.warn('No floors to move, returning 0');
			return null;
		}
		return nextFloor;
	}


	//--------------------------------Not used anymore. keeping for now.--------------------------------
	// /**
	//  * Calculate the total time it will take to traverse a list of stops using {@link doorOpenTime}
	//  * and {@link travelTimePerFloor}.
	//  *
	//  * @param stops - The stops to traverse.
	//  * @param startFloor - The floor the elevator starts from (not included in the `stops`)
	//  * @returns The total time in milliseconds.
	//  */
	// totalTimeOfStoplist(stops: OrderedStops, startFloor: number): number {
	// 	//...then get the number of floors we're going to traverse for the entire trip which gives
	// 	//us the travel time...
	// 	const totalDistance = Strategy.totalDistanceOfStoplist(stops, startFloor);
	// 	const travelTime = totalDistance * this.options.travelTimePerFloor;

	// 	//...then get the total time spent on the floors (won't include people opening the doors again, obviously)
	// 	const dwellTime = stops.length * this.options.doorOpenTime;

	// 	return travelTime + dwellTime;
	// }

	// /**
	//  * @returns The total distance in 'number of floors' to travel to a list of stops in order.
	//  */
	// static totalDistanceOfStoplist(stops: Iterable<number>, startFloor: number): number {
	// 	let distance = 0;
	// 	let last = startFloor;
	// 	for (const floor of stops) {
	// 		if (last !== undefined) {
	// 			distance += Math.abs(floor - last);
	// 		}
	// 		last = floor;
	// 	}
	// 	return distance;
	// }
}