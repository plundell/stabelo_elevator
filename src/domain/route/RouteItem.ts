import { Floor, ConditionalFloor } from "./Floors";

/**
 * A requested visit on the route.
 * 
 * Contains extra information to allow for visits being conditional on other 
 * visits (see {@link visitNow()} for details)
 */
export class RouteItem {

	/**
	 * The floor this RouteItem represents. It's only use inside this class is to ensure
	 * deleteOnVisit only adds ConditionalFloors which match this floor.
	 */
	public readonly floor: Floor;

	/**
	 * Floors to visit after this floor is visited. When `ElevatorRoute.visitNow()` is called it will remove this
	 * RouteItem from the queue and create new RouteItems for all these {@link ConditionalFloor}. 
	 */
	private readonly _visitAfter: Array<ConditionalFloor> = [];

	get visitAfter(): Array<ConditionalFloor> {
		return this._visitAfter.slice();
	}

	/**
	 * ConditionalFloors to delete when this floor is visited. When ElevatorRoute.visitNow() is called it will 
	 * remove this RouteItem from the queue, then loop through this array and remove the {@link ConditionalFloor}
	 * it contains from the queue as well.
	 */
	private readonly _deleteOnVisit: Array<ConditionalFloor> = [];
	get deleteOnVisit(): Array<ConditionalFloor> {
		return this._deleteOnVisit.slice();
	}

	/**
	 * The number of times this floor has been requested. Only reason this exists is to
	 * allow strategies to optionally use it to decide visit order.
	 */
	private _requestCount: number = 1;

	get requestCount(): number {
		return this._requestCount;
	}

	/** 
	 * @param itemToCopy Optional. A route item to copy.
	 */
	constructor(floor: Floor);
	constructor(itemToCopy: RouteItem);
	constructor(floorOrItem: RouteItem | Floor) {
		if (typeof floorOrItem === 'number') {
			this.floor = floorOrItem;
		} else {
			this.floor = floorOrItem.floor;
			this._visitAfter = floorOrItem.visitAfter;
			this._requestCount = floorOrItem.requestCount;
		}
	}

	/**
	 * Mark a floor to be visited after this floor is visited.
	 * @param floor The other floor
	 * @returns A new {@link ConditionalFloor} which needs to be added to the queue after this RouteItem.
	 */
	addVisitAfter(floor: Floor): ConditionalFloor {
		const cf = new ConditionalFloor(floor);
		this._visitAfter.push(cf);
		return cf;
	}

	/**
	 * Mark a ConditionalFloor to be deleted when this floor is visited.
	 * @param cf The ConditionalFloor to delete.
	 * @returns The ConditionalFloor itself.
	 */
	addDeleteOnVisit(cf: ConditionalFloor): ConditionalFloor {
		this._deleteOnVisit.push(cf);
		return cf;
	}

	/**
	 * Request this floor again (increases counter and can be used by strategies to decide when to visit the floor)
	 * @returns The new request count.
	 */
	requestAgain(): number {
		return this._requestCount++;
	}

	/**
	 * Create a copy of this route item which is not linked to the original.
	 * @returns A new route item with the same addOnVisit and requestCount.
	 */
	copy(): RouteItem {
		return new RouteItem(this);
	}
}
