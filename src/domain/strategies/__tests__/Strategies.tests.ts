import { ElevatorRoute } from '../../route/ElevatorRoute';
import { InsertOrder } from '../InsertOrder';
import { StopEnRoute } from '../StopEnRoute';
import { StrategyOptions } from '../Strategy';

/**
 * These tests are **unit tests for `Strategy` implementations**.
 *
 * What we are testing:
 * - `getOrderedStops()`: Returns an ordered list of floors to stop at based on the strategy's logic
 * - `getNrFloorsToMove()`: Returns the direction (1 for up, -1 for down) to move
 *
 * Test strategy:
 * - We test strategies in isolation using `ElevatorRoute` directly
 * - We verify that strategies correctly order stops and determine movement direction
 * - No timers or elevator state machines are involved - pure unit tests
 */
const strategyOptions: StrategyOptions = {
	TRAVEL_TIME_PER_FLOOR: 2000,
	DOOR_OPEN_TIME: 5000,
	ESTIMATION_LIMIT: 10,
};

describe('Strategies', () => {
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

			expect(stops).toEqual([5]);
			// Should stop at 5 and not continue to 7 or 10
		});
	});

	describe('StopEnRoute strategy', () => {
		let strategy: StopEnRoute;
		let route: ElevatorRoute;

		beforeEach(() => {
			strategy = new StopEnRoute(strategyOptions);
			route = new ElevatorRoute();
		});

		/**
		 * With `StopEnRoute`, stops are returned in insertion order, but intermediate floors
		 * that are in the route are included when traversing to a destination.
		 */
		it('should return stops in insertion order', () => {
			route.addRide(7);
			route.addRide(5);
			route.addRide(10);

			const stops = strategy.getOrderedStops(route, 3);

			expect(stops).toEqual([7, 5, 10]);
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
});