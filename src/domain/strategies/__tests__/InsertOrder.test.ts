import { ElevatorRoute } from '../../route/ElevatorRoute';
import { InsertOrder } from '../InsertOrder';
import { StrategyOptions } from '../Strategy';


const strategyOptions: StrategyOptions = {
	TRAVEL_TIME_PER_FLOOR: 2000,
	DOOR_OPEN_TIME: 5000,
	ESTIMATION_LIMIT: 10000, // 10 seconds in milliseconds
};


describe('InsertOrder strategy', () => {
	let strategy: InsertOrder;
	let route: ElevatorRoute;

	beforeEach(() => {
		strategy = new InsertOrder(strategyOptions);
		route = new ElevatorRoute();
	});

	/**
	 * With `InsertOrder`, stops are returned in the order they were added to the route.
	 * It does not include intermediate floors that weren't explicitly requested.
	 */
	it('should return stops in insertion order', () => {
		route.addRide(7);
		route.addRide(5);
		route.addRide(10);

		const stops = strategy.getOrderedStops(route, 3);

		expect(stops).toEqual([7, 5, 10]);
	});

	/**
	 * Demonstrate the "skip intermediate stops" behavior:
	 * - If we add 7 first and then 5, the stops are returned in insertion order: [7, 5]
	 * - Floor 5 is not visited before floor 7, even though it's on the way
	 */
	it('should not include intermediate floors even if they are in route', () => {
		route.addRide(7);
		route.addRide(5);

		const stops = strategy.getOrderedStops(route, 3);

		expect(stops).toEqual([7, 5]);
		// Floor 5 is not visited before 7, even though we pass it on the way to 7
	});

	/**
	 * Test that `getNrFloorsToMove` returns the correct direction based on the next floor.
	 */
	it('should return 1 for moving up when next floor is above current floor', () => {
		route.addRide(7);
		const floorsToMove = strategy.getNrFloorsToMove(route, 3);
		expect(floorsToMove).toBe(1);
	});

	it('should return -1 for moving down when next floor is below current floor', () => {
		route.addRide(1);
		const floorsToMove = strategy.getNrFloorsToMove(route, 3);
		expect(floorsToMove).toBe(-1);
	});

	it('should return 0 when route is empty', () => {
		const floorsToMove = strategy.getNrFloorsToMove(route, 3);
		expect(floorsToMove).toBe(0);
	});

	it('should respect targetFloor parameter', () => {
		route.addRide(7);
		route.addRide(5);
		route.addRide(10);

		const stops = strategy.getOrderedStops(route, 3, 5);

		// InsertOrder processes stops in insertion order, so it visits 7 first, then stops at 5
		expect(stops).toEqual([7, 5]);
	});
});
