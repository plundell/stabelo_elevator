import { Logger } from "../../infra/logger/Logger";
import { ElevatorRoute } from "../route/ElevatorRoute";
import { StopEarly, Strategy } from "./Strategy";

/**
* This strategy will:
*  - Go directly to floors in the order they were added to the route.
*/
export class InsertOrder extends Strategy {


	getOrderedStops(route: ElevatorRoute, _: number, targetFloor?: number, stopEarly?: StopEarly): number[] {

		//Initialize the list of stops to return.
		const stops: number[] = [];

		//If a target floor was provided... 
		if (typeof targetFloor == 'number') {
			// ...we add it to the route to make sure we stop at it (if it's already
			// in the set it doesn't change anything).
			route.addRide(targetFloor);
		}

		//Loop through the stops in the insert order and add them to the list of stops.
		outer: for (const nextStop of route) {
			stops.push(nextStop)
			route.visitNow(nextStop)
			if (stopEarly?.(nextStop, stops)) break outer;
			//TODO: this^ always needs to be before the target floor check, need to find a good way to ensure that for future strategies...
			if (nextStop === targetFloor) break outer; //when target is undefined this never happens
		}
		return stops;
	}

	getNrFloorsToMove(route: ElevatorRoute, currentFloor: number): number {
		let nextFloor = super.getNextFloor(route, currentFloor);
		if (nextFloor === null) {
			return 0;
		}
		return nextFloor > currentFloor ? 1 : -1;
	}
}
