/**
 * Create a range of numbers from start to end. This works for negative numbers too.
 * @param start - The start of the range.
 * @param end - The end of the range.
 * @returns An array of numbers from start to end.
 */
export function range(start: number, end: number): number[] {
	const rng: number[] = [];
	if (start < end)
		for (let i = start; i <= end; i++) rng.push(i);
	else
		for (let i = start; i >= end; i--) rng.push(i);
	return rng;
}


