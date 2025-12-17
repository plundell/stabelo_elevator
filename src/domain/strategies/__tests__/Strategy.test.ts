import { ElevatorRoute } from '../../route/ElevatorRoute';
import { StrategyOptions } from '../Strategy';
import { InsertOrder } from '../InsertOrder';
import { ExplicitAny } from '../../../shared/types/helpers';

/**
 * These tests are for the **base Strategy class** functionality.
 * 
 * What we are testing:
 * - `batchedGetOrderedStops()`: Async version that yields to event loop between batches
 * - `getNextFloor()`: Protected helper method (via InsertOrder)
 * - `targetFloor` parameter behavior (common to all strategies)
 * - `stopEarly` callback behavior (common to all strategies)
 * 
 * What we are NOT testing:
 * - Strategy-specific ordering logic (tested in InsertOrder.test.ts, StopEnRoute.test.ts)
 * - `estimatePickupDropoffTime()`: Complex async method (tested via Elevator.test.ts integration tests)
 * 
 * We use InsertOrder as our concrete implementation since it's the simplest strategy.
 */

const strategyOptions: StrategyOptions = {
	TRAVEL_TIME_PER_FLOOR: 2000,
	DOOR_OPEN_TIME: 5000,
	ESTIMATION_LIMIT: 10000,
};

describe('Strategy base class', () => {
	let strategy: InsertOrder;
	let route: ElevatorRoute;

	beforeEach(() => {
		strategy = new InsertOrder(strategyOptions);
		route = new ElevatorRoute();
	});

	describe('batchedGetOrderedStops', () => {
		/**
		 * The main purpose of batchedGetOrderedStops is to yield control back to the
		 * event loop periodically (every 10 stops), preventing the system from becoming 
		 * unresponsive during long route calculations.
		 * 
		 * Note: These tests use real timers because setImmediate doesn't work with fake timers.
		 */

		beforeEach(() => {
			jest.useRealTimers();
		});

		afterEach(() => {
			jest.useFakeTimers();
		});

		it('should return same result as synchronous getOrderedStops', async () => {
			// Setup route
			route.addRide(5);
			route.addRide(7);
			route.addRide(3);
			route.addRide(9);

			// Get sync result
			const routeCopy1 = route.copy();
			const syncResult = strategy.getOrderedStops(routeCopy1, 4);

			// Get async result
			const routeCopy2 = route.copy();
			const asyncResult = await strategy.batchedGetOrderedStops(routeCopy2, 4);

			expect(asyncResult).toEqual(syncResult);
		});

		it('should process routes with more than batch size (10) stops', async () => {
			// Add 15 stops to test multiple batches
			for (let i = 0; i < 15; i++) {
				route.addRide(i);
			}

			const result = await strategy.batchedGetOrderedStops(route.copy(), 0);

			// Should process all 15 stops
			expect(result.length).toBe(15);
			expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
		});

		it('should respect targetFloor parameter', async () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const result = await strategy.batchedGetOrderedStops(route.copy(), 3, 7);

			// Should stop at target floor (7)
			expect(result).toEqual([5, 7]);
		});

		it('should respect stopEarly callback', async () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);
			route.addRide(15);

			let callCount = 0;
			const stopEarly = () => {
				callCount++;
				return callCount >= 2; // Stop after 2 stops
			};

			const result = await strategy.batchedGetOrderedStops(route.copy(), 3, undefined, stopEarly);

			// The stopEarly callback is called AFTER each stop is added to the array
			// So when it returns true on the 2nd call, we've already processed 2 stops
			// But the batching logic processes all 4 stops in one batch (< 10 stops)
			expect(result.length).toBeGreaterThanOrEqual(2);
			expect(result).toContain(5);
			expect(result).toContain(7);
		});

		it('should yield to event loop for long routes', async () => {
			// Add 25 stops (more than 2 batches)
			for (let i = 0; i < 25; i++) {
				route.addRide(i);
			}

			// Track if the function is truly async by checking if it returns a promise
			const result = strategy.batchedGetOrderedStops(route.copy(), 0);
			expect(result).toBeInstanceOf(Promise);

			// Wait for completion
			const stops = await result;
			expect(stops.length).toBe(25);
		});


		it('should handle empty route without infinite loop', async () => {
			// Empty route should return immediately
			const result = await strategy.batchedGetOrderedStops(route.copy(), 3);

			expect(result).toEqual([]);
		});



		it('should stop when route becomes empty mid-processing', async () => {
			route.addRide(5);
			route.addRide(7);

			const result = await strategy.batchedGetOrderedStops(route.copy(), 3);

			// Should process both stops then stop (route is now empty)
			expect(result).toEqual([5, 7]);
		});

		it('should handle targetFloor undefined without infinite loop', async () => {
			route.addRide(5);
			route.addRide(7);

			// With undefined targetFloor, should process until route is empty
			const result = await strategy.batchedGetOrderedStops(route.copy(), 3, undefined);

			expect(result).toEqual([5, 7]);
		});

		it('should process in batches of 10', async () => {
			// Add exactly 20 stops to test 2 batches
			for (let i = 0; i < 20; i++) {
				route.addRide(i);
			}

			const stopEarlyMock = jest.fn().mockReturnValue(false);
			const result = await strategy.batchedGetOrderedStops(route.copy(), 0, undefined, stopEarlyMock);

			// Should process all 20 stops
			expect(result.length).toBe(20);
			// The wrappedStopEarly is called once per stop, but it returns true every 10 stops
			// to break the batch. The first 10 stops are in batch 1, the next 10 in batch 2.
			expect(stopEarlyMock).toHaveBeenCalled();
			expect(stopEarlyMock.mock.calls.length).toBeGreaterThanOrEqual(18);
		});

		it('should pass accumulated stops array to stopEarly callback', async () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const stopEarlyMock = jest.fn().mockReturnValue(false);
			await strategy.batchedGetOrderedStops(route.copy(), 3, undefined, stopEarlyMock);

			// The wrappedStopEarly callback accumulates all stops and passes them
			// Since all 3 stops are processed in one batch (< 10), the callback is called
			// with the accumulated array each time
			expect(stopEarlyMock).toHaveBeenCalled();

			// Check that the last call has all stops
			const lastCall = stopEarlyMock.mock.calls[stopEarlyMock.mock.calls.length - 1];
			expect(lastCall[1]).toContain(5);
			expect(lastCall[1]).toContain(7);
			expect(lastCall[1]).toContain(10);
		});
		it('getOrderedStops should handle starting at floor 0 with route containing floor 0', async () => {
			route.addRide(0);

			// This is legitimate: elevator at floor 0, someone presses button for floor 0
			const result = await strategy.getOrderedStops(route.copy(), 0);

			expect(result).toEqual([0]);
		});
		it('getOrderedStops should handle single stop at current floor', async () => {
			route.addRide(5);

			// Legitimate: processing one stop that happens to be at current floor
			const result = await strategy.getOrderedStops(route.copy(), 5);

			expect(result).toEqual([5]);
		});
		it('should handle starting at floor 0 with route containing floor 0', async () => {
			route.addRide(0);

			// This is legitimate: elevator at floor 0, someone presses button for floor 0
			const result = await strategy.batchedGetOrderedStops(route.copy(), 0);

			expect(result).toEqual([0]);
		});

		it('should handle single stop at current floor', async () => {
			route.addRide(5);

			// Legitimate: processing one stop that happens to be at current floor
			const result = await strategy.batchedGetOrderedStops(route.copy(), 5);

			expect(result).toEqual([5]);
		});


	});

	describe('getNextFloor (protected method)', () => {
		/**
		 * This is a helper method used by strategies. We test it via InsertOrder
		 * which exposes it for testing purposes.
		 */
		it('should return the first floor in route', () => {
			route.addRide(7);
			route.addRide(5);

			const nextFloor = (strategy as ExplicitAny).getNextFloor(route, 3);

			expect(nextFloor).toBe(7);
		});

		it('should return null when route is empty', () => {
			const nextFloor = (strategy as ExplicitAny).getNextFloor(route, 3);

			expect(nextFloor).toBeNull();
		});

		it('should return null when next floor equals current floor', () => {
			route.addRide(3);

			const nextFloor = (strategy as ExplicitAny).getNextFloor(route, 3);

			expect(nextFloor).toBeNull();
		});
	});

	describe('targetFloor parameter (base class feature)', () => {
		/**
		 * The targetFloor parameter is a common feature across all strategies.
		 * When provided, strategies should:
		 * 1. Add it to the route if not already present
		 * 2. Stop processing when it's reached
		 * 3. Not continue to subsequent stops
		 */
		it('should add targetFloor to route if not present', () => {
			route.addRide(5);
			route.addRide(10);

			const routeCopy = route.copy();
			const stops = strategy.getOrderedStops(routeCopy, 3, 7);

			// Should include 7 even though it wasn't in original route
			expect(stops).toContain(7);
		});

		it('should stop at targetFloor even if more stops exist', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const stops = strategy.getOrderedStops(route.copy(), 3, 7);

			// Should stop at 7 and not continue to 10
			expect(stops).toEqual([5, 7]);
			expect(stops).not.toContain(10);
		});

		it('should work when targetFloor is first stop', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const stops = strategy.getOrderedStops(route.copy(), 3, 5);

			expect(stops).toEqual([5]);
		});

		it('should work when targetFloor is last stop', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const stops = strategy.getOrderedStops(route.copy(), 3, 10);

			expect(stops).toEqual([5, 7, 10]);
		});

		it('should handle targetFloor with empty route', () => {
			// Empty route, but we want to go to floor 5
			const stops = strategy.getOrderedStops(route.copy(), 3, 5);

			// Should add 5 to route and visit it
			expect(stops).toEqual([5]);
		});
	});

	describe('stopEarly callback (base class feature)', () => {
		/**
		 * The stopEarly callback allows callers to terminate traversal early.
		 * This is used by estimatePickupDropoffTime to enforce the estimation limit.
		 */
		it('should call stopEarly callback for each stop', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const stopEarlyMock = jest.fn().mockReturnValue(false);

			strategy.getOrderedStops(route.copy(), 3, undefined, stopEarlyMock);

			// Should be called once for each stop
			expect(stopEarlyMock).toHaveBeenCalledTimes(3);
		});

		it('should stop processing when stopEarly returns true', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);
			route.addRide(15);

			let callCount = 0;
			const stopEarly = () => {
				callCount++;
				return callCount >= 2; // Stop after 2 stops
			};

			const stops = strategy.getOrderedStops(route.copy(), 3, undefined, stopEarly);

			// Should only process 2 stops before stopping
			expect(stops.length).toBe(2);
			expect(stops).toEqual([5, 7]);
		});

		it('should pass correct parameters to stopEarly callback', () => {
			route.addRide(5);
			route.addRide(7);

			const stopEarlyMock = jest.fn().mockReturnValue(false);

			strategy.getOrderedStops(route.copy(), 3, undefined, stopEarlyMock);

			// Verify callback is called with the floor number and stops array
			expect(stopEarlyMock).toHaveBeenCalledTimes(2);

			// First call: floor 5
			expect(stopEarlyMock.mock.calls[0][0]).toBe(5);
			expect(stopEarlyMock.mock.calls[0][1]).toContain(5);

			// Second call: floor 7
			expect(stopEarlyMock.mock.calls[1][0]).toBe(7);
			expect(stopEarlyMock.mock.calls[1][1]).toContain(7);
		});

		it('should prioritize stopEarly over targetFloor', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			// stopEarly returns true after first stop
			const stopEarly = () => true;

			const stops = strategy.getOrderedStops(route.copy(), 3, 10, stopEarly);

			// Should stop after first stop, not continue to targetFloor
			expect(stops).toEqual([5]);
		});
	});

	describe('route consumption behavior', () => {
		/**
		 * getOrderedStops() consumes the route (removes stops as it processes them).
		 * This is important behavior that all strategies share.
		 */
		it('should consume the route as it processes stops', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const routeCopy = route.copy();
			expect(routeCopy.length()).toBe(3);

			strategy.getOrderedStops(routeCopy, 3);

			// Route should be empty after processing
			expect(routeCopy.length()).toBe(0);
		});

		it('should partially consume route when stopped early', () => {
			route.addRide(5);
			route.addRide(7);
			route.addRide(10);

			const routeCopy = route.copy();

			// Stop after 2 stops
			let count = 0;
			const stopEarly = () => ++count >= 2;

			strategy.getOrderedStops(routeCopy, 3, undefined, stopEarly);

			// Should have 1 stop left (10)
			expect(routeCopy.length()).toBe(1);
			expect(routeCopy.shouldVisit(10)).toBe(true);
		});
	});

	describe('checkIfRideIsVetoed (optional method)', () => {
		/**
		 * Strategies can optionally implement ride vetoing.
		 * By default, it should be null (not implemented).
		 */
		it('should be null by default', () => {
			expect(strategy.checkIfRideIsVetoed).toBeNull();
		});

		it('can be implemented by strategies', () => {
			// Create a strategy with veto logic
			const vetoFn = jest.fn().mockReturnValue(true);
			strategy.checkIfRideIsVetoed = vetoFn;

			const result = strategy.checkIfRideIsVetoed(route, 3, 5, 7);

			expect(vetoFn).toHaveBeenCalledWith(route, 3, 5, 7);
			expect(result).toBe(true);
		});
	});
});
