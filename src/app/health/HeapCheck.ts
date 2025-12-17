import { ComponentHealthCheck } from "../../domain/health/ComponentHealthCheck";

/**
 * The default percentage of heap usage above which the health check will fail which
 * will report the system as unhealthy.
 */
const DEFAULT_HEAP_THRESHOLD = 0.9;

export function CreateHeapChecker(pctThreshold: number = DEFAULT_HEAP_THRESHOLD): ComponentHealthCheck {
	return new ComponentHealthCheck('memory', () => {
		const used = process.memoryUsage();
		const pctUsed = used.heapUsed / used.heapTotal;
		const pctUsedStr = pctUsed.toFixed(2);
		if (pctUsed > pctThreshold) {
			throw new Error(`High heap usage: ${pctUsedStr}%`);
		}
		return `Heap usage: ${pctUsedStr}%`;
	});
}