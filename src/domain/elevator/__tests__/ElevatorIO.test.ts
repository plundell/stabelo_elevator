import { ElevatorIO, ElevatorIOOptions } from '../ElevatorIO';
import { ElevatorStateType, IdleState, MovingUpState, MovingDownState, DoorsOpenState } from '../types';


/**
 * Base configuration for elevator tests.
 * We use realistic time values (2000ms per floor, 5000ms door open time) because
 * we're using fake timers - this allows us to test timing logic without actually
 * waiting for real time to pass. The values are large enough to be meaningful
 * but small enough that if real timers were accidentally used, tests wouldn't
 * take forever.
 */
const baseOptions: ElevatorIOOptions = {
	INITIAL_FLOOR: 3,
	TRAVEL_TIME_PER_FLOOR: 2000,
	DOOR_OPEN_TIME: 5000,
};


describe('ElevatorIO', () => {
	let io: ElevatorIO;

	/**
	 * Setup before each test:
	 * - Enable fake timers: This replaces setTimeout/setInterval with Jest's controllable
	 *   timer system. We can then use jest.advanceTimersByTime() to instantly advance
	 *   time without waiting. This is essential because ElevatorIO uses setTimeout to
	 *   schedule state transitions (moving -> idle, doorsOpen -> idle).
	 * - Create a fresh ElevatorIO instance: Each test starts with a clean elevator
	 *   at the initial floor in IDLE state.
	 */
	beforeEach(() => {
		//We use fake timers so we don't have to wait for real time to pass
		//and so we don't have to choose a very small value for our options.
		jest.useFakeTimers();

		io = new ElevatorIO(baseOptions);
	});

	/**
	 * Cleanup after each test:
	 * - Clear all pending timers: Ensures no timers from one test leak into the next
	 * - Restore real timers: Important for test isolation and to avoid affecting
	 *   other test suites that might use real timers
	 */
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	/**
	 * Tests for basic initialization and state access methods.
	 * We test these first because other tests rely on getState() working correctly.
	 * This follows the "ordered way" pattern - establish that basic methods work
	 * before using them to verify more complex behaviors.
	 */
	describe('Initialization and state access', () => {
		/**
		 * Test that the constructor creates a valid ElevatorIO instance.
		 * This is the most basic test - if this fails, nothing else will work.
		 */
		it('constructor should create an instance', () => {
			expect(io).toBeInstanceOf(ElevatorIO);
		});

		/**
		 * Test that getState() returns a complete state object with required properties.
		 * We verify that all states have a 'type' and 'startTime' property, which are
		 * common to all state types. This ensures the state object structure is correct
		 * before we test specific state values.
		 */
		it('should be able to access complete state', () => {
			const state = io.getState();
			expect(state.type).toBeTruthy(); //these exist on all states
			expect(state.startTime).toBeTruthy();
		});

		/**
		 * Test that the elevator starts in the correct initial state.
		 * When constructed, the elevator should be:
		 * - In IDLE state (not moving, doors closed)
		 * - At the initialFloor specified in options
		 * - With a startTime that's very recent (within 100ms of now)
		 * 
		 * We use a tolerance for startTime because there might be a tiny delay
		 * between construction and the test assertion, even with fake timers.
		 */
		it('initial state should be idle at the initial floor', () => {
			const state = io.getState();
			expect(state.type).toBe(ElevatorStateType.IDLE);
			expect((state as IdleState).atFloor).toBe(baseOptions.INITIAL_FLOOR);
			expect(Math.abs(state.startTime - Date.now())).toBeLessThanOrEqual(100);
		});

		/**
		 * Test that getState() returns a defensive copy, not a reference to internal state.
		 * This is important for immutability - external code shouldn't be able to
		 * mutate the elevator's internal state by modifying the returned object.
		 * 
		 * How we test: Get state, mutate the copy, then verify the original is unchanged.
		 * If getState() returned a reference, mutating the copy would change the original.
		 */
		it('should return a copy of state and allow property access', () => {
			const snapshot = io.getState();
			(snapshot as IdleState).atFloor = 99; //mutate copy
			expect(io.getState('atFloor')).toBe(baseOptions.INITIAL_FLOOR); //original should not have changed
		});
	});

	/**
	 * Tests for elevator movement functionality.
	 * Movement is a core feature: the elevator should transition from IDLE -> MOVING -> IDLE
	 * based on the move() command, with proper timing and event emissions.
	 */
	describe('Movement', () => {

		/**
		 * Test input validation: moving zero floors is nonsensical and should be rejected.
		 * This prevents invalid state transitions and ensures the API is used correctly.
		 */
		it('should throw when asked to move zero floors', () => {
			expect(() => io.move(0)).toThrow('Cannot move by 0 floors');
		});

		/**
		 * Test upward movement with full state transition cycle.
		 * 
		 * What we're testing:
		 * 1. When move(2) is called, the elevator should immediately transition to MOVING_UP
		 * 2. The MOVING_UP event should be emitted with correct state (fromFloor, toFloor, dueTime)
		 * 3. The dueTime should be calculated correctly (current time + travel time)
		 * 4. After the travel time elapses, it should transition back to IDLE
		 * 5. The IDLE event should be emitted with the elevator at the new floor
		 * 
		 * How we test:
		 * - Register event listeners to capture state transitions
		 * - Call move() and immediately verify MOVING_UP state and event
		 * - Use jest.advanceTimersByTime() to simulate time passing (this is why we need fake timers)
		 * - Verify IDLE state and event after the time advance
		 * 
		 * Why this approach:
		 * - We test both immediate state change AND delayed state change
		 * - We verify events are emitted correctly (important for event-driven architecture)
		 * - We verify timing calculations are correct
		 */
		it('should emit movingUp then idle after travel time', () => {
			const movingListener = jest.fn();
			const idleListener = jest.fn();
			io.on(ElevatorStateType.MOVING_UP, movingListener);
			io.on(ElevatorStateType.IDLE, idleListener);

			io.move(2);

			// Immediately after move(), should be in MOVING_UP state
			expect(movingListener).toHaveBeenCalledTimes(1);
			const movingState = movingListener.mock.calls[0][0] as MovingUpState;
			expect(movingState.type).toBe(ElevatorStateType.MOVING_UP);
			expect(movingState.fromFloor).toBe(baseOptions.INITIAL_FLOOR);
			expect(movingState.toFloor).toBe(baseOptions.INITIAL_FLOOR + 2);
			expect(movingState.dueTime).toBe(Date.now() + baseOptions.TRAVEL_TIME_PER_FLOOR * 2);
			expect(io.getState('type')).toBe(ElevatorStateType.MOVING_UP);

			// Advance time by the travel duration to trigger the scheduled state change
			jest.advanceTimersByTime(baseOptions.TRAVEL_TIME_PER_FLOOR * 2);

			// After travel time, should transition to IDLE at the destination floor
			expect(idleListener).toHaveBeenCalledTimes(1);
			const idleState = idleListener.mock.calls[0][0] as IdleState;
			expect(idleState.atFloor).toBe(baseOptions.INITIAL_FLOOR + 2);
			expect(io.getState('type')).toBe(ElevatorStateType.IDLE);
			expect(io.getState('startTime')).toBe(Date.now());
		});

		/**
		 * Test downward movement - same as upward but with negative floor count.
		 * This verifies that the elevator correctly handles both directions and
		 * calculates the destination floor correctly (subtracting instead of adding).
		 */
		it('should emit movingDown then idle after travel time', () => {
			const movingListener = jest.fn();
			const idleListener = jest.fn();
			io.on(ElevatorStateType.MOVING_DOWN, movingListener);
			io.on(ElevatorStateType.IDLE, idleListener);

			io.move(-2);

			expect(movingListener).toHaveBeenCalledTimes(1);
			const movingState = movingListener.mock.calls[0][0] as MovingDownState;
			expect(movingState.type).toBe(ElevatorStateType.MOVING_DOWN);
			expect(movingState.fromFloor).toBe(baseOptions.INITIAL_FLOOR);
			expect(movingState.toFloor).toBe(baseOptions.INITIAL_FLOOR - 2);
			expect(movingState.dueTime).toBe(Date.now() + baseOptions.TRAVEL_TIME_PER_FLOOR * 2);
			expect(io.getState('type')).toBe(ElevatorStateType.MOVING_DOWN);

			jest.advanceTimersByTime(baseOptions.TRAVEL_TIME_PER_FLOOR * 2);

			expect(idleListener).toHaveBeenCalledTimes(1);
			const idleState = idleListener.mock.calls[0][0] as IdleState;
			expect(idleState.atFloor).toBe(baseOptions.INITIAL_FLOOR - 2);
			expect(io.getState('type')).toBe(ElevatorStateType.IDLE);
		});

		/**
		 * Test that the elevator enforces state machine rules: can't start a new move
		 * while already moving. This prevents invalid state transitions and ensures
		 * the elevator completes one movement before starting another.
		 * 
		 * Why this matters: In a real elevator, you can't change direction mid-travel.
		 * The state machine should enforce this constraint.
		 */
		it('should not accept a new move while already moving', () => {
			io.move(1);
			expect(() => io.move(1)).toThrow(/not idle/i);
		});
	});

	/**
	 * Tests for door control functionality.
	 * Doors can only be opened when the elevator is IDLE or already has DOORS_OPEN.
	 * When opened, doors stay open for a configured duration, then automatically close
	 * (transition back to IDLE). Multiple openDoors() calls should extend the duration.
	 */
	describe('Door controls', () => {

		/**
		 * Test the basic door open/close cycle.
		 * 
		 * What we're testing:
		 * 1. openDoors() should transition from IDLE -> DOORS_OPEN
		 * 2. DOORS_OPEN event should be emitted with correct state (atFloor, dueTime)
		 * 3. The dueTime should be calculated correctly (current time + doorOpenTime)
		 * 4. After doorOpenTime elapses, should transition back to IDLE
		 * 5. IDLE event should be emitted (doors closed)
		 * 
		 * How we test:
		 * - Register listeners for both state transitions
		 * - Call openDoors() and verify immediate DOORS_OPEN state
		 * - Advance time by doorOpenTime to trigger automatic door closing
		 * - Verify IDLE state is reached
		 * 
		 * Why this matters: Doors need to stay open long enough for passengers
		 * to board/exit, then automatically close to allow the elevator to continue.
		 */
		it('should open doors when idle and then return to idle after the delay', () => {
			const doorsListener = jest.fn();
			const idleListener = jest.fn();
			io.on(ElevatorStateType.DOORS_OPEN, doorsListener);
			io.on(ElevatorStateType.IDLE, idleListener);

			io.openDoors();

			// Immediately after openDoors(), should be in DOORS_OPEN state
			expect(doorsListener).toHaveBeenCalledTimes(1);
			const doorsState = doorsListener.mock.calls[0][0] as DoorsOpenState;
			expect(doorsState.type).toBe(ElevatorStateType.DOORS_OPEN);
			expect(doorsState.atFloor).toBe(baseOptions.INITIAL_FLOOR);
			expect(doorsState.dueTime).toBe(Date.now() + baseOptions.DOOR_OPEN_TIME);
			expect(io.getState('type')).toBe(ElevatorStateType.DOORS_OPEN);

			// Advance time by doorOpenTime to trigger automatic door closing
			jest.advanceTimersByTime(baseOptions.DOOR_OPEN_TIME);

			// After doorOpenTime, should transition back to IDLE (doors closed)
			expect(idleListener).toHaveBeenCalledTimes(1);
			expect((idleListener.mock.calls[0][0] as IdleState).atFloor).toBe(baseOptions.INITIAL_FLOOR);
			expect(io.getState('type')).toBe(ElevatorStateType.IDLE);
		});

		/**
		 * Test that doors cannot be opened while the elevator is moving.
		 * This enforces safety: doors should only open when stationary.
		 * 
		 * How we test: Start a movement, then try to open doors. Should throw an error.
		 */
		it('should throw if asked to open doors while moving', () => {
			io.move(1);
			expect(() => io.openDoors()).toThrow(/cannot open doors/i);
		});

		/**
		 * Test that calling openDoors() multiple times extends the door open duration.
		 * 
		 * What we're testing:
		 * - If doors are already open and openDoors() is called again, the timeout
		 *   should be replaced with a new one (extending the duration)
		 * - This simulates the "door open" button being pressed repeatedly
		 * 
		 * How we test:
		 * 1. Open doors and note the first dueTime
		 * 2. Advance time to just before the original timeout (50ms before)
		 * 3. Call openDoors() again - this should replace the timeout
		 * 4. Advance past the original timeout - doors should still be open
		 * 5. Advance by the full doorOpenTime from the second call - now doors should close
		 * 
		 * Why this matters: In real elevators, repeatedly pressing the door open button
		 * keeps the doors open longer, giving passengers more time to board/exit.
		 */
		it('should extend open duration when called again while doors are open', () => {
			const idleListener = jest.fn();
			io.on(ElevatorStateType.IDLE, idleListener);

			// First door open - doors should close after doorOpenTime
			io.openDoors();
			const firstDoorsState = io.getState() as DoorsOpenState;
			expect(firstDoorsState.dueTime).toBe(Date.now() + baseOptions.DOOR_OPEN_TIME);

			// Advance to just before the original timeout would fire
			jest.advanceTimersByTime(baseOptions.DOOR_OPEN_TIME - 50);

			// Call openDoors() again - should replace the previous timeout with a new one
			io.openDoors(); //should replace previous timeout
			const secondDoorsState = io.getState() as DoorsOpenState;
			expect(secondDoorsState.dueTime).toBe(Date.now() + baseOptions.DOOR_OPEN_TIME);

			// Advance past the original timeout - doors should still be open because timeout was replaced
			jest.advanceTimersByTime(100); //past the original timeout
			expect(idleListener).toHaveBeenCalledTimes(0); //should not have closed yet
			expect(io.getState('type')).toBe(ElevatorStateType.DOORS_OPEN);

			// Now advance by the full doorOpenTime from the second call - doors should close
			jest.advanceTimersByTime(baseOptions.DOOR_OPEN_TIME);

			expect(idleListener).toHaveBeenCalledTimes(1);
			expect(io.getState('type')).toBe(ElevatorStateType.IDLE);
		});
	});
});

