import { ElevatorRoute } from "../route/ElevatorRoute";
import { StopEarly, Strategy } from "./Strategy";
import { range } from "../../shared/util";

/**
* This strategy will:
*  - Go to floors in the order they were added to the route.
*  - If when traveling to a floor we pass another floor we're due to visit later
*    then stop at that floor first and then keep going.
*/
export class StopEnRoute extends Strategy {


	getOrderedStops(route: ElevatorRoute, currentFloor: number, targetFloor?: number, stopEarly?: StopEarly): number[] {

		//Initialize the list of stops to return.
		const stops: number[] = [];

		//If a target floor was provided... 
		if (typeof targetFloor == 'number') {
			// ...we add it to the route to make sure we stop at it (if it's already
			// in the set it doesn't change anything).
			route.addRide(targetFloor) //floor validated inside
		}

		//Loop through the stops in the insert order (standard iteration of our Set)...
		outer: for (const nextStop of route) {
			//...for each journey (current->nextStop) we check out all the floors in between...
			for (currentFloor of range(currentFloor, nextStop)) {
				//...and if that's one of the floors we'd be visiting later then we make a stop now
				//instead (we can alter the Set as we go and that will affect the iterator above)
				if (route.shouldVisit(currentFloor)) {
					stops.push(currentFloor)
					route.visitNow(currentFloor)
					if (stopEarly?.(currentFloor, stops)) break outer;
					//TODO: this^ always needs to be before the target floor check, need to find a good way to ensure that for future strategies...
					if (currentFloor === targetFloor) break outer; //when target is undefined this never happens
				}
			}
			//at this point current==nextStop which will carry over to the next iteration
		}
		return stops;
	}

	getNrFloorsToMove(route: ElevatorRoute, currentFloor: number): number {
		const nextFloor = super.getNextFloor(route, currentFloor);
		if (nextFloor === null) {
			return 0;
		}
		return nextFloor > currentFloor ? 1 : -1;
	}


	// checkIfRideIsVetoed=(route: ElevatorRoute, startFloor: number, pickupFloor: number, dropoffFloor: number): boolean => {
	// 	return false;
	// }
}
