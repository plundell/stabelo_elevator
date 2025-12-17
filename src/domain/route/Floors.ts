import { AppOptions } from "../../options";
import { InvalidFloorError, ValidationError } from "../errors/ValidationErrors";


/**
 * A type alias for a floor number. Used for readability since we also have {@link ConditionalFloor}.
 */
export type Floor = number;


/**
 * Check if a value is a floor number.
 * @param floor The value to check.
 * @returns True if the value is a floor number, false otherwise.
 */
export function isFloor(floor: unknown): floor is Floor {
	return Number.isInteger(floor)
}



type FloorRange = Pick<AppOptions, 'MIN_FLOOR' | 'MAX_FLOOR'>;



/**
 * Validate a floor number.
 * @param floor The unknownvalue to validate.
 * @throws A TypeError if the value is not a floor number.
 */
export function validateFloor(floor: unknown): void;
/**
 * Validate a floor number within a given range.
 * @param floor The unknown value to validate.
 * @param range - The {@link FloorRange} to validate against (inclusive).
 * @throws A TypeError if the value is not a floor number.
 * @throws A RangeError if the value is outside the given range.
 */
export function validateFloor(floor: unknown, range: FloorRange, argName?: string): void;
export function validateFloor(floor: unknown, range?: FloorRange, argName?: string): void {
	try {
		if (!isFloor(floor))
			throw new TypeError(`Floors must be an integers.`);
		if (range?.MIN_FLOOR !== undefined && floor < range.MIN_FLOOR)
			throw new RangeError(`Below the minimum floor ${range.MIN_FLOOR}`);
		if (range?.MAX_FLOOR !== undefined && floor > range.MAX_FLOOR)
			throw new RangeError(`Above the maximum floor ${range.MAX_FLOOR}`);
	} catch (cause) {
		throw new InvalidFloorError(floor, cause as Error, argName);
	}
}

/**
 * Validate a pickup and dropoff floor
 * @param pickupFloor First unknown value to validate.
 * @param dropoffFloor Optional second unknown value to validate (for typescript you pass `undefined` explicitly to omit it)
 * @param range - The {@link FloorRange} to validate against (inclusive).
 * @throws A TypeError if the value is not a floor number.
 * @throws A RangeError if the value is outside the given range.
 */
export function validateFloors(pickupFloor: unknown, dropoffFloor: unknown, range: FloorRange): void {
	validateFloor(pickupFloor, range, 'pickupFloor');
	if (dropoffFloor !== undefined) {
		validateFloor(dropoffFloor, range, 'dropoffFloor');
	}
}


/**
 * A Symbol-like wrapper for a {@link Floor} number which makes it unique, but allows for easy 
 * conversion backto a number. Once created the value inside cannot be changed. It's `valueOf()`
 * returns a number which implies the following: 
 * 
 * ```typescript
 * const cf = new ConditionalFloor(4);
 * cf == 4 //true
 * map.set(cf, "four"); //works
 * map.has(cf) //true
 * map.has(4) //false
 * ```
 * 
*/
export class ConditionalFloor {
	constructor(public readonly floor: Floor) {
		validateFloor(floor)
	}
	valueOf(): number {
		return this.floor;
	}
}