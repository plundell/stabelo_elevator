import { Elevator, ElevatorOptions } from '../Elevator';
import { ElevatorStateType, IdleState } from '../types';
import { MockStrategy } from '../../strategies/__tests__/MockStrategy';
import { ExplicitAny } from '../../../shared/types/helpers';
import { StrategyOptions } from '../../strategies/Strategy';
import { InvalidFloorError } from '../../errors/ValidationErrors';
import { ElevatorIO } from '../ElevatorIO';
import { ElevatorRoute } from '../../route/ElevatorRoute';

/**
 * These tests are **unit tests for `Elevator` orchestration**.
 *
 * What we are testing:
 * - The `Elevator` coordinates `ElevatorRoute`, `ElevatorIO`, and `Strategy` correctly
 * - It makes the right decisions: when to move, when to open doors, when to consult the strategy
 * - It validates input and manages its lifecycle properly
 *
 * What we are NOT testing:
 * - Timing details of `ElevatorIO` (covered by `ElevatorIO.test.ts`)
 * - Route data structure operations (covered by `ElevatorRoute.test.ts`)
 * - Strategy algorithms (covered by `Strategies.test.ts`)
 *
 * Test strategy:
 * - We spy on `io.move()` and `io.openDoors()` to verify Elevator makes correct decisions
 * - We check route state to verify Elevator manages the route correctly
 * - We minimize use of timer advancement - only when necessary to trigger state changes
 */
const elevatorOptions: ElevatorOptions & StrategyOptions = {
	MIN_FLOOR: 0,
	MAX_FLOOR: 10,
	INITIAL_FLOOR: 3,
	TRAVEL_TIME_PER_FLOOR: 2000,
	DOOR_OPEN_TIME: 5000,
	ESTIMATION_LIMIT: 10000,
};


describe('Elevator', () => {
	let elevator: Elevator;
	let io: ElevatorIO;
	let route: ElevatorRoute;
	let strategy: MockStrategy;

	beforeEach(() => {
		jest.useFakeTimers();
		strategy = new MockStrategy(elevatorOptions);
		elevator = new Elevator("test-elevator", strategy, elevatorOptions);
		io = (elevator as ExplicitAny).io;
		route = (elevator as ExplicitAny).route;
	});

	afterEach(() => {
		elevator.shutdown();
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('Initialization', () => {
		it('should create an instance', () => {
			expect(elevator).toBeInstanceOf(Elevator);
		});

		it('should start in idle state at initial floor', () => {
			const state = io.getState();
			expect(state.type).toBe(ElevatorStateType.IDLE);
			expect((state as IdleState).atFloor).toBe(elevatorOptions.INITIAL_FLOOR);
		});

		it('should have an empty route', () => {
			expect(route.length()).toBe(0);
		});
	});

	describe('addRide - Input validation', () => {
		it('should throw InvalidFloorError when floor is below minFloor', () => {
			expect(() => elevator.addRide(-1)).toThrow(InvalidFloorError);
		});

		it('should throw InvalidFloorError when floor is above maxFloor', () => {
			expect(() => elevator.addRide(11)).toThrow(InvalidFloorError);
		});

		it('should accept floor at minFloor boundary', () => {
			expect(() => elevator.addRide(elevatorOptions.MIN_FLOOR)).not.toThrow();
		});

		it('should accept floor at maxFloor boundary', () => {
			expect(() => elevator.addRide(elevatorOptions.MAX_FLOOR)).not.toThrow();
		});
	});

	describe('addRide - Route integration', () => {
		it('should add floor to route', () => {
			elevator.addRide(5);
			expect(route.shouldVisit(5)).toBe(true);
			expect(route.length()).toBe(1);
		});

		it('should add multiple floors to route', () => {
			elevator.addRide(5);
			elevator.addRide(7);
			elevator.addRide(2);
			expect(route.length()).toBe(3);
			expect(route.shouldVisit(5)).toBe(true);
			expect(route.shouldVisit(7)).toBe(true);
			expect(route.shouldVisit(2)).toBe(true);
		});

		it('should handle duplicate floor requests', () => {
			elevator.addRide(5);
			elevator.addRide(5);
			// Route should still have only one entry for floor 5
			expect(route.length()).toBe(1);
			expect(route.shouldVisit(5)).toBe(true);
		});
	});

	describe('addRide - IO integration (when idle)', () => {
		it('should call io.move() when idle and stop is added above current floor', () => {
			const moveSpy = jest.spyOn(io, 'move');
			elevator.addRide(5);
			expect(moveSpy).toHaveBeenCalledWith(1); // MockStrategy moves 1 floor at a time
		});

		it('should call io.move() when idle and stop is added below current floor', () => {
			const moveSpy = jest.spyOn(io, 'move');
			elevator.addRide(1);
			expect(moveSpy).toHaveBeenCalledWith(-1); // MockStrategy moves 1 floor at a time
		});

		it('should call io.openDoors() when stop is added at current floor', () => {
			const openDoorsSpy = jest.spyOn(io, 'openDoors');
			elevator.addRide(elevatorOptions.INITIAL_FLOOR);
			expect(openDoorsSpy).toHaveBeenCalled();
		});

		it('should not call io.move() when stop is added while already moving', () => {
			const moveSpy = jest.spyOn(io, 'move');
			elevator.addRide(5);
			expect(moveSpy).toHaveBeenCalledTimes(1);

			// Add another stop while moving
			elevator.addRide(7);
			// Should still only have been called once
			expect(moveSpy).toHaveBeenCalledTimes(1);
		});

		it('should not call io.move() when stop is added while doors are open', () => {
			const moveSpy = jest.spyOn(io, 'move');
			// Open doors at current floor
			elevator.addRide(elevatorOptions.INITIAL_FLOOR);
			moveSpy.mockClear(); // Clear the openDoors call

			// Add a new stop while doors are open
			elevator.addRide(5);
			// Should not call move while doors are open
			expect(moveSpy).not.toHaveBeenCalled();
		});
	});

	describe('Strategy integration', () => {
		it('should consult strategy for direction when moving', () => {
			const getNrFloorsToMoveSpy = jest.spyOn(strategy, 'getNrFloorsToMove');
			elevator.addRide(5);
			expect(getNrFloorsToMoveSpy).toHaveBeenCalledWith(
				route,
				elevatorOptions.INITIAL_FLOOR
			);
		});

		it('should use strategy result to determine move distance', () => {
			const moveSpy = jest.spyOn(io, 'move');
			// MockStrategy returns 1 for upward movement
			elevator.addRide(5);
			expect(moveSpy).toHaveBeenCalledWith(1);
		});
	});

	describe('Event-driven orchestration', () => {
		it('should remove stop from route after opening doors', () => {
			elevator.addRide(elevatorOptions.INITIAL_FLOOR);
			// Doors should open immediately since we're already at this floor
			expect(route.shouldVisit(elevatorOptions.INITIAL_FLOOR)).toBe(false);
		});

		it('should continue to next stop after doors close', () => {
			const moveSpy = jest.spyOn(io, 'move');

			// Add two stops
			elevator.addRide(elevatorOptions.INITIAL_FLOOR); // Opens doors immediately
			elevator.addRide(5);

			moveSpy.mockClear(); // Clear any previous calls

			// Advance time to close doors
			jest.advanceTimersByTime(elevatorOptions.DOOR_OPEN_TIME);

			// Should now move to the next stop
			expect(moveSpy).toHaveBeenCalledWith(1);
		});

		it('should open doors after arriving at a scheduled stop', () => {
			const openDoorsSpy = jest.spyOn(io, 'openDoors');

			elevator.addRide(4); // One floor up from initial floor (3)
			openDoorsSpy.mockClear(); // Clear the initial move

			// Advance time to arrive at floor 4
			jest.advanceTimersByTime(elevatorOptions.TRAVEL_TIME_PER_FLOOR);

			// Should open doors at the destination
			expect(openDoorsSpy).toHaveBeenCalled();
		});

		it('should not open doors when arriving at a non-scheduled floor', () => {
			const openDoorsSpy = jest.spyOn(io, 'openDoors');

			// Add a stop 2 floors up
			elevator.addRide(5);
			openDoorsSpy.mockClear();

			// Advance time to arrive at floor 4 (intermediate floor, not scheduled)
			jest.advanceTimersByTime(elevatorOptions.TRAVEL_TIME_PER_FLOOR);

			// Should not open doors at floor 4
			expect(openDoorsSpy).not.toHaveBeenCalled();
		});

		it('should continue moving after passing a non-scheduled floor', () => {
			const moveSpy = jest.spyOn(io, 'move');

			elevator.addRide(5); // Two floors up
			moveSpy.mockClear();

			// Arrive at floor 4 (intermediate)
			jest.advanceTimersByTime(elevatorOptions.TRAVEL_TIME_PER_FLOOR);

			// Should continue moving up
			expect(moveSpy).toHaveBeenCalledWith(1);
		});
	});

	describe('Complex scenarios', () => {
		it('should handle stops added while moving', () => {
			elevator.addRide(5);

			// Start moving (advance halfway)
			jest.advanceTimersByTime(elevatorOptions.TRAVEL_TIME_PER_FLOOR / 2);

			// Add another stop while moving
			elevator.addRide(7);

			// Both stops should be in the route
			expect(route.shouldVisit(5)).toBe(true);
			expect(route.shouldVisit(7)).toBe(true);
		});

		it('should handle stops added while doors are open', () => {
			const moveSpy = jest.spyOn(io, 'move');

			// Open doors at current floor
			elevator.addRide(elevatorOptions.INITIAL_FLOOR);

			// Add a new stop while doors are open
			elevator.addRide(5);
			expect(route.shouldVisit(5)).toBe(true);

			moveSpy.mockClear();

			// Close doors
			jest.advanceTimersByTime(elevatorOptions.DOOR_OPEN_TIME);

			// Should now move to the new stop
			expect(moveSpy).toHaveBeenCalledWith(1);
		});

		it('should handle direction changes', () => {
			const moveSpy = jest.spyOn(io, 'move');

			// Go up first
			elevator.addRide(5);
			expect(moveSpy).toHaveBeenCalledWith(1);

			// Arrive and open doors at floor 5
			jest.advanceTimersByTime(elevatorOptions.TRAVEL_TIME_PER_FLOOR * 2);
			moveSpy.mockClear();

			// Add a stop below current position
			elevator.addRide(1);

			// Close doors
			jest.advanceTimersByTime(elevatorOptions.DOOR_OPEN_TIME);

			// Should now move down
			expect(moveSpy).toHaveBeenCalledWith(-1);
		});

		it('should process multiple stops in sequence', () => {
			const openDoorsSpy = jest.spyOn(io, 'openDoors');

			elevator.addRide(4);
			elevator.addRide(5);
			elevator.addRide(6);

			openDoorsSpy.mockClear();

			// Arrive at floor 4
			jest.advanceTimersByTime(elevatorOptions.TRAVEL_TIME_PER_FLOOR);
			expect(openDoorsSpy).toHaveBeenCalledTimes(1);

			// Close doors and move to floor 5
			jest.advanceTimersByTime(elevatorOptions.DOOR_OPEN_TIME + elevatorOptions.TRAVEL_TIME_PER_FLOOR);
			expect(openDoorsSpy).toHaveBeenCalledTimes(2);

			// Close doors and move to floor 6
			jest.advanceTimersByTime(elevatorOptions.DOOR_OPEN_TIME + elevatorOptions.TRAVEL_TIME_PER_FLOOR);
			expect(openDoorsSpy).toHaveBeenCalledTimes(3);
		});
	});

	describe('shutdown', () => {
		it('should be safe to call', () => {
			expect(() => elevator.shutdown()).not.toThrow();
		});

		it('should be safe to call multiple times', () => {
			expect(() => {
				elevator.shutdown();
				elevator.shutdown();
				elevator.shutdown();
			}).not.toThrow();
		});

		it('should stop automatic event-driven progression', () => {
			const moveSpy = jest.spyOn(io, 'move');

			// Open doors
			elevator.addRide(elevatorOptions.INITIAL_FLOOR);
			elevator.addRide(5);

			// Shutdown
			elevator.shutdown();

			moveSpy.mockClear();

			// Close doors - normally this would trigger movement
			jest.advanceTimersByTime(elevatorOptions.DOOR_OPEN_TIME);

			// Should NOT move because we've shut down the event listener
			expect(moveSpy).not.toHaveBeenCalled();
		});

		it('should still allow manual addRide to trigger movement if idle', () => {
			const moveSpy = jest.spyOn(io, 'move');

			elevator.shutdown();

			// addRide() explicitly calls tellElevatorWhatToDoNext() when idle
			elevator.addRide(5);
			expect(moveSpy).toHaveBeenCalledWith(1);
		});
	});

	describe('estimatePickupDropoffTime', () => {
		beforeEach(() => {
			// Use real timers for async tests since they use setImmediate
			jest.useRealTimers();
		});

		afterEach(() => {
			// Restore fake timers for other tests
			jest.useFakeTimers();
		});

		it('should delegate to strategy with correct parameters', async () => {
			const estimateSpy = jest.spyOn(strategy, 'estimatePickupDropoffTime');

			await elevator.estimatePickupDropoffTime(5, 7);

			expect(estimateSpy).toHaveBeenCalledWith(
				expect.any(ElevatorRoute), // route copy
				elevatorOptions.INITIAL_FLOOR, // current floor
				5, // pickup
				7  // dropoff
			);
		});

		it('should pass a copy of the route to strategy', async () => {
			const estimateSpy = jest.spyOn(strategy, 'estimatePickupDropoffTime');

			await elevator.estimatePickupDropoffTime(5, 7);

			const passedRoute = estimateSpy.mock.calls[0][0];
			// Should be a different instance than the actual route
			expect(passedRoute).not.toBe(route);
		});

		it('should not modify the actual route', async () => {
			elevator.addRide(10);
			const initialLength = route.length();

			await elevator.estimatePickupDropoffTime(5, 7);

			// Route should be unchanged
			expect(route.length()).toBe(initialLength);
			expect(route.shouldVisit(10)).toBe(true);
		});

		it('should return the result from strategy', async () => {
			// Mock the strategy to return a specific value
			jest.spyOn(strategy, 'estimatePickupDropoffTime').mockResolvedValue(5000);

			const time = await elevator.estimatePickupDropoffTime(5, 7);

			expect(time).toBe(5000);
		});
	});

	describe('checkIfRideIsVetoed', () => {
		it('should return false when strategy has no veto function', () => {
			const vetoed = elevator.checkIfRideIsVetoed(5, 7);
			expect(vetoed).toBe(false);
		});

		it('should delegate to strategy when veto function exists', () => {
			const vetoFn = jest.fn().mockReturnValue(true);
			strategy.checkIfRideIsVetoed = vetoFn;

			const vetoed = elevator.checkIfRideIsVetoed(5, 7);

			expect(vetoFn).toHaveBeenCalledWith(
				route,
				elevatorOptions.INITIAL_FLOOR,
				5,
				7
			);
			expect(vetoed).toBe(true);
		});

		it('should not add vetoed ride to route', () => {
			strategy.checkIfRideIsVetoed = jest.fn().mockReturnValue(true);

			elevator.addRide(5, 7);

			// Route should be empty since ride was vetoed
			expect(route.length()).toBe(0);
		});
	});

	describe('isFree', () => {
		it('should return true when idle with no stops', () => {
			expect(elevator.isFree()).toBe(true);
		});

		it('should return false when route has stops', () => {
			elevator.addRide(5);
			expect(elevator.isFree()).toBe(false);
		});

		it('should return false when moving', () => {
			elevator.addRide(5);
			// Elevator is now moving
			expect(elevator.isFree()).toBe(false);
		});

		it('should return false when doors are open', () => {
			elevator.addRide(elevatorOptions.INITIAL_FLOOR);
			// Doors are now open
			expect(elevator.isFree()).toBe(false);
		});
	});

	describe('getRouteLength', () => {
		it('should return 0 for empty route', () => {
			expect(elevator.getRouteLength()).toBe(0);
		});

		it('should return correct length for route with stops', () => {
			elevator.addRide(5);
			elevator.addRide(7);
			elevator.addRide(2);
			expect(elevator.getRouteLength()).toBe(3);
		});
	});
});
