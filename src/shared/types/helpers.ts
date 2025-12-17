/**
 * An alias for the `any` type but with the eslint rule disabled. That way
 * we can easily import it anywhere we really really intend to use any.
 */
export type ExplicitAny = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * A utility type which omits a specific key from each type in a union of types.
 * @param T - The union of objects to omit the key from.
 * @param K - The key to omit from the union of objects.
 * @returns A union of objects, each without the key.
 */
export type DistributiveOmit<T, K extends keyof ExplicitAny> = T extends ExplicitAny ? Omit<T, K> : never;



/**
 * A utility type which gets the keys of a union of objects.
 * @param T - The union of objects to get the keys from.
 * @returns A union of keys.
 */
export type KeysOfUnion<T> = T extends ExplicitAny ? keyof T : never;