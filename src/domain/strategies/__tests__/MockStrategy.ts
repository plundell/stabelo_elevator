import { ElevatorRoute } from "../../route/ElevatorRoute";
import { Floor } from "../../route/Floors";
import { OrderedStops, StopEarly, Strategy } from "../Strategy";

/**
 * A simple mock strategy for testing that implements basic elevator logic:
 * - Moves one floor at a time toward the next destination
 * - Visits floors in insertion order
 * 
 * This is suitable for unit testing the Elevator orchestration logic without
 * worrying about complex strategy behavior.
 */
export class MockStrategy extends Strategy {

	/**
	 * Returns stops in insertion order, consuming the route as it goes.
	 */
	override getOrderedStops(route: ElevatorRoute, _: number, targetFloor?: number, stopEarly?: StopEarly): OrderedStops {
		const stops: number[] = [];

		if (typeof targetFloor === 'number') {
			route.addRide(targetFloor);
		}

		for (const nextStop of route) {
			stops.push(nextStop);
			route.visitNow(nextStop);
			if (stopEarly?.(nextStop, stops)) break;
			if (nextStop === targetFloor) break;
		}

		return stops;
	}

	/**
	 * Returns 1 to move up one floor, -1 to move down one floor, or 0 if no movement needed.
	 * This simulates a simple elevator that moves one floor at a time.
	 */
	override getNrFloorsToMove(route: ElevatorRoute, currentFloor: Floor): number {
		const nextFloor = super.getNextFloor(route, currentFloor);
		if (nextFloor === null) {
			return 0;
		}
		return nextFloor > currentFloor ? 1 : -1;
	}

	/**
	 * Expose the protected getNextFloor method for testing.
	 */
	public override getNextFloor(route: ElevatorRoute, currentFloor: number): number | null {
		return super.getNextFloor(route, currentFloor);
	}
}