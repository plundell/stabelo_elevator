import { ElevatorRoute } from '../../route/ElevatorRoute';
import { StopEnRoute } from '../StopEnRoute';
import { StrategyOptions } from '../Strategy';


const strategyOptions: StrategyOptions = {
	TRAVEL_TIME_PER_FLOOR: 2000,
	DOOR_OPEN_TIME: 5000,
	ESTIMATION_LIMIT: 10000, // 10 seconds in milliseconds
};

describe('StopEnRoute strategy', () => {
	let strategy: StopEnRoute;
	let route: ElevatorRoute;

	beforeEach(() => {
		strategy = new StopEnRoute(strategyOptions);
		route = new ElevatorRoute();
	});

	/**
	 * With `StopEnRoute`, stops are returned in traversal order (when encountered during travel),
	 * not insertion order. Intermediate floors that are in the route are included when traversing.
	 */
	it('should return stops in traversal order, not insertion order', () => {
		route.addRide(7);
		route.addRide(5);
		route.addRide(10);

		const stops = strategy.getOrderedStops(route, 3);

		// When going from 3 to 7, we encounter 5 first, so stops are [5, 7, 10]
		expect(stops).toEqual([5, 7, 10]);
	});

	/**
	 * Demonstrate the "stop at intermediate floors" behavior:
	 * - If we add 7 first and then 5, when traveling from 3 to 7, we pass floor 5
	 * - Since floor 5 is in the route, `StopEnRoute` includes it in the stops: [5, 7]
	 * - The order is based on when we encounter them during traversal, not insertion order
	 */
	it('should include intermediate floors if they are in route', () => {
		route.addRide(7);
		route.addRide(5);

		const stops = strategy.getOrderedStops(route, 3);

		// When going from 3 to 7, we pass floor 5, so it should be included
		expect(stops).toEqual([5, 7]);
	});

	/**
	 * Test that intermediate floors are only included if they're actually in the route.
	 */
	it('should not include intermediate floors that are not in route', () => {
		route.addRide(7);

		const stops = strategy.getOrderedStops(route, 3);

		// Floor 5 is not in the route, so it shouldn't be included
		expect(stops).toEqual([7]);
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

		expect(stops).toEqual([5]);
		// Should stop at 5 and not continue to 7 or 10
	});

	it('should handle multiple intermediate stops correctly', () => {
		route.addRide(10);
		route.addRide(5);
		route.addRide(7);
		route.addRide(6);

		const stops = strategy.getOrderedStops(route, 3);

		// When going from 3 to 10, we encounter 5, 6, 7 in order
		expect(stops).toEqual([5, 6, 7, 10]);
	});


});