import { TypedMap } from "../../shared/util/TypedMap";
import { RouteItem } from "./RouteItem";
import { Floor, ConditionalFloor, validateFloor, isFloor } from "./Floors";
import { TypedEventEmitter } from "../../infra/events/TypedEventEmitter";
import { Logger } from "../../infra/logger/Logger";

/**
 * An event emitted both then new floors are requested to be visited and when they are visited.
 * This helps clients keep track of which buttons should be lit up.
 */
export type ButtonActiveEvent = { floor: Floor, active: boolean }

/**
 * Events which can be emitted by the ElevatorRoute class. 
 */
export type ElevatorRouteEventMap = {
	buttons: ButtonActiveEvent
}


/**
 * This class keeps track of the floors an elevator has been told to visit.
 */
export class ElevatorRoute extends TypedEventEmitter<ElevatorRouteEventMap> implements Iterable<Floor> {


	/**
	 * A ordered queue of floors to visit. Technically we're using a Map in a typesafe wrapper.
	 * The reason we're using a Map and not:
	 * - an array: O(1) deletion anywhere, O(1) inclusion check
	 * - an object: reliable insert-order iteration, V8 doesn't deoptimize of high churn
	 * - a Set: could do, but with map we can store key+value instead of maintaining separate 
	 *   objects for the additional data we need (see {@link RouteItem})
	 * 
	 * {@link Floor} keys represent floors we can visit right now and they map to {@link RouteItem}s
	 * 
	 * {@link ConditionalFloor} keys represent floors we only can visit in the order it appears in 
	 * the queue. They don't map to anything but their existence is tracked by RouteItems.
	 */
	private route = new TypedMap<{ key: Floor, value: RouteItem } | { key: ConditionalFloor, value: unknown }>();

	/**
	 * A map of {@link Floor} to arrays of {@link ConditionalFloor} which `visitNow()` will delete
	 * when we visit that floor. This map is also populated by `visitNow()` with values from {@link RouteItem.addOnVisit}
	 * Read more about this in {@link visitNow()}. 
	 */
	private deleteOnVisit = new Map<Floor, Array<ConditionalFloor>>();
	//TODO: I may be wrong here. maybe this can go on RouteItem...

	//TODO: this feels ugly. we have the same class EventRoute which sometimes is treaded as an entity and sometimes as a 
	//      value object, that's no good.... not cleeeean...
	constructor(logger?: Logger);
	constructor(routeToCopy?: ElevatorRoute);
	constructor(arg?: ElevatorRoute | Logger) {
		//Call super TypedEventEmitter with the logger if it's provided.
		super(arg instanceof Logger ? arg : undefined);

		//If the argument is an ElevatorRoute, copy its route. Do not copy the logger from the original 
		if (arg instanceof ElevatorRoute) {
			for (const floor of arg.route.keys()) {
				const item = arg.route.get(floor);
				this.route.set(floor, item instanceof RouteItem ? item.copy() : item!); //! to make typescript happy. it never is undef because .keys()
				//NOTE: floor can be a ConditionalFloor and we add that as-is, i.e. as an object. If we
				// didn't that would break the link to it in whichever RouteItem holds it.
			}
		}
	}

	/**
	 * Create a new route with the same floors to stop at in the same order
	 * but which is entirely independent of the original.
	 */
	copy(): ElevatorRoute {
		return new ElevatorRoute(this);
	}

	/**
	 * @returns The number of floors to stop at in the route.
	 */
	length(): number {
		return this.route.size;
	}



	/**
	 * Get the floor who's turn it is to be visited next.
	 * 
	 * @note Unlike {@link shouldVisit()}, this method **will return** {@link ConditionalFloor} if it's 
	 * the first item in the queue.
	 * 
	 * @returns The first/next floor in the route, or undefined if the route is empty.
	 */
	first(): Floor | undefined {
		const key = this.route.keys().next().value;
		return key !== undefined ? Number(key) : undefined;
	}


	/**
	 * Get an iterator over the floors in the order {@link addRide()} was called. 
	 * Yields each floor as a number (converting ConditionalFloor keys via Number()).
	 * You can call {@link visitNow()} during iteration to remove future stops from
	 * the ongoing iteration and the route itself.
	 */
	*[Symbol.iterator](): IterableIterator<Floor> {
		for (const key of this.route.keys()) {
			yield Number(key);
		}
	}

	/**
	 * Get an array of the floors in the order {@link addRide()} was called. This will
	 * include **both** Floor and ConditionalFloor, but they will all have been converted 
	 * to {@link Floor} numbers.
	 * 
	 * @throws Never
	 */
	toArray(): Floor[] {
		return Array.from(this);
	}

	//TODO: The naming here is confusing. Buttons. Floors. Route. Queue.... must fix!
	/**
	 * Get an array of {@link Floor} **only**, in no particular order. 
	 * These represent the "floors in the route" or "the buttons which are currently lit up"
	 */
	getPushedButtons(): Floor[] {
		return Array.from(this.route.keys()).filter(isFloor);
	}

	/**
	 * Get the last floor in the route.
	 * NOTE: This is O(n) time complexity.
	 * @returns The last floor in the route, or undefined if the route is empty.
	 */
	last(): number | undefined {
		let last;
		for (const key of this.route.keys()) {
			last = key;
		}
		return last !== undefined ? Number(last) : undefined;
	}
	//TODO, don't think we need this. it's just used the the tests




	/**
	 * Add a floor as a future stop on the route (what happens when you press a button in
	 * the elevator or outside the elevators to summon it). 
	 * 
	 * @note This is almost idempotent. Calling it multiple times will increment a counter
	 * which strategies may choose to use, but it won't add it multiple times to the route.
	 * 
	 * @param pickup The floor to add as a {@link RouteItem} to the {@link route} right now. 
	 * @param dropoff Optional. A floor which will be added as a {@link ConditionalFloor} to 
	 *                the RouteItem mentioned above AND to the queue.
	 * @return The {@link RouteItem} we just created or fetched from the queue. This is used
	 *         by {@link visitNow()} when upgrading ConditionalFloors to RouteItems.
	 */
	addRide(pickup: Floor, dropoff?: Floor): RouteItem {
		//Make sure we have an iteger and not a NaN or Decimal. Since this is the only place
		//we add stuff to the queue, this is the only place we can mess it up.
		validateFloor(pickup);

		//Check if the floor is already in the queue...
		let item = this.route.get(pickup);
		if (item === undefined) {
			//...if not create a new RouteItem and add it
			item = new RouteItem(pickup);
			this.route.set(pickup, item);
			this.emit('buttons', { floor: pickup, active: true });
		} else {
			//...if it is increment the request count
			item.requestAgain();
		}

		//If there is a dropoff, add it to the RouteItem AND place the ConditionalFloor
		//it returns in the queue which ensures it retains it's place in line.
		if (dropoff !== undefined) {
			validateFloor(dropoff);
			const cf = item.addVisitAfter(dropoff);
			this.route.set(cf, true);
		}

		return item
	}

	/**
	 * Check whether elevator should stop at a floor. This does:
	 *  - not make the stop
	 *  - not alter the route
	 *  - not consider the insert order 
	 *  - **ignores {@link ConditionalFloor} entirely**
	 * 
	 * @param floor The floor to check	
	 * @returns True if the elevator should stop at the floor, false otherwise.
	 * @throws Never, even on bad input.
	 */
	shouldVisit(floor: Floor): boolean {
		return this.route.has(floor)
	}

	/**
	 * Register that the elevator has stopped at a floor. This alters the route by removing 
	 * the `floor` from the {@link route}, but it also handles {@link ConditionalFloor} which
	 * may have been stored on the {@link RouteItem} of the floor we just removed, heres how:
	 * 
	 * When we added the floor with {@link addRide} in the past, we optionally specified a 
	 * second floor to stop at after. At the time we set 2 things on the {@link route} and then
	 * linked them in a way (psuedo code):
	 * ```typescript
	 * this.length() //0, no floors in the queue
	 * this.requestVisit(3,4)
	 * let r = new RouteItem()
	 * let cf4 = r.visitAfter(4)
	 * this.queue.set(3, r)
	 * this.queue.set(cf4, true) //this keeps cf4's place in line
	 * this.length() //2, keys are [3, cf4]
	 * this.shouldVisit(3) //true
	 * this.shouldVisit(4) //false - ignores cf4,won't stop at 4 yet
	 * this.first() //3
	 * ...
	 * this.requestVisit(10)
	 * this.requestVisit(13)
	 * ```
	 * Now however we want to stop at 4, so we add it as a regular RouteItem(4) which will be added
	 * last in line if no RouteItem(4) already exists. If we happen to travese floor 4 on another 
	 * trip before then (and the strategy allows it), sure we can now stop for him, but if not it 
	 * would be unfair to let him wait until last; however, he won't have to because after we've 
	 * stopped at 3 this happens (psuedo code):
	 * ```typescript
	 * this.visitNow(3);
	 * this.length() //4, keys are [cf4, 10, 13, 4]
	 * this.shouldVisit(4) //true, still ignores cf4, but now we have 4
	 * this.first() //4, not because of 4 which is last, but because first() recognizes cf4 as a 4
	 * //move to 4
	 * ```
	 * 
	 * @param floor The floor to make a stop at.
	 * @returns True if the floor was removed from the set, false otherwise.
	 * @throws Never, even on bad input or multiple calls for the same floor.
	 */
	visitNow(floor: Floor): boolean {
		//Check if it's in the queue else return false
		const item = this.route.get(floor)
		if (item === undefined) return false;

		//Any ConditionalFloors which where waiting on this floor should now be 
		//added as regular RouteItems, with the cf attached as something to 
		//delete when we eventually visit that floor...
		for (const cf of item.visitAfter) {
			this.addRide(Number(cf)).addDeleteOnVisit(cf);
		}

		//...and speaking of that delete, let's delete any ConditionalFloors attached to this floor
		for (const cf of item.deleteOnVisit) {
			this.route.delete(cf);
		}

		//Finally remove from the queue and return true
		this.route.delete(floor);
		this.emit('buttons', { floor: floor, active: false });
		return true;
	}




}

