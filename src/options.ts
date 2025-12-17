/**
 * All options fot he application. See {@link DefaultOptions} below.
 */

export type AppOptions = {

	/** The time in milliseconds it takes to travel between 2 consecutive floors */
	TRAVEL_TIME_PER_FLOOR: number;

	/** 
	 * The time in milliseconds the elevator stays on a floor when making 
	 * a stop (includes doors opening, staying open, then closing) 
	 */
	DOOR_OPEN_TIME: number;

	/** 
	 * In order to optimize elevator usage we use {@link Strategy} to decide 
	 * where to go next. When picking which elevator should accept a specific
	 * ride the strategy simulates an elevator's journey to estimate how 
	 * long it would take that elevator to complete the ride. The intention
	 * is to find synergies, but it comes at the cost of running these simulations
	 * and at as we scale the marginal benifit of a slightly better estimation
	 * isn't worth that. As such, this value limits how long into the future we
	 * attempt to simulate before adopting a simpler {@link fallbackStragegy}.
	 * 
	 * Value in milliseconds to match travelTimePerFloor and doorOpenTime.
	 */
	ESTIMATION_LIMIT: number;


	/** 
	 * When deciding which elevator to use, should the first rule be to use a
	 * free elevator if one exists, even if it's not the closest one?
	 */
	USE_FREE_FIRST: boolean;

	//TODO: add options to reposition free elevators to prepare for future use

	/** The lowest floor inclusive the elevator can travel to (can be negative) */
	MIN_FLOOR: number;

	/** The highest floor inclusive the elevator can travel to */
	MAX_FLOOR: number;

	/** The number of elevators contained in the ElevatorBank */
	NR_OF_ELEVATORS: number;

	/** The floor the elevator starts at*/
	INITIAL_FLOOR: number;

	/** The log level */
	LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
};





export const defaultOptions: AppOptions = {
	TRAVEL_TIME_PER_FLOOR: 1000,
	DOOR_OPEN_TIME: 1000,
	ESTIMATION_LIMIT: 10000,
	MIN_FLOOR: 0,
	MAX_FLOOR: 20,
	NR_OF_ELEVATORS: 5,
	INITIAL_FLOOR: 0,
	USE_FREE_FIRST: true,
	LOG_LEVEL: 'debug',
};


export function parseOptions(options: Record<string, unknown>, defaultOptions: AppOptions): AppOptions {
	const parsedOptions: AppOptions = { ...defaultOptions };
	for (const key of Object.keys(defaultOptions)) {
		const dirtyValue = options[key as keyof typeof options];
		if (dirtyValue !== undefined) {
			const defaultValue = defaultOptions[key as keyof typeof defaultOptions];
			const optionKey = key as keyof AppOptions;
			if (typeof defaultValue === 'number') {
				(parsedOptions[optionKey] as number) = parseInt(String(dirtyValue), 10);
			} else if (typeof defaultValue === 'boolean') {
				(parsedOptions[optionKey] as boolean) = String(dirtyValue).toLowerCase() === 'true';
			} else {
				(parsedOptions[optionKey] as typeof defaultValue) = dirtyValue as typeof defaultValue;
			}
		}
	}
	return parsedOptions;
}