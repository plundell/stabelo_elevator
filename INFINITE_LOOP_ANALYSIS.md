# Infinite Loop Detection Analysis

## The Journey to Correct Infinite Loop Detection

### Original Bug
`batchedGetOrderedStops()` had an infinite loop when the user's `stopEarly` callback returned `true`:
- The inner loop would break without consuming the route
- The outer loop would run again with the same route
- This would repeat forever

### Fix #1: The `done` Flag ✅
Added a `done` flag that gets set when the user's `stopEarly` returns `true`:

```typescript
if (stopEarly?.(nextStop, stops) ?? false) {
    done = true; // Prevent outer loop from continuing
    return true;
}

while (!done && currentFloor !== targetFloor && route.length() > 0) {
    // ...
}
```

**This fixed the main bug!**

### Attempt #2: Check if All Recent Stops Are Same Floor ❌

**Attempted Check:**
```typescript
if (stops.slice(-10).every(stop => stop === currentFloor)) {
    throw new BUGBUG('Infinite loop!', ...);
}
```

**Problems (False Positives):**
1. Processing floor 0 once: `stops=[0]`, all equal 0 → ❌ THROWS
2. Processing floor 5 once: `stops=[5]`, all equal 5 → ❌ THROWS
3. Empty stops array: `[].every(...)` returns `true` → ❌ THROWS

**Why It Failed:** Checking if all recent stops are the same doesn't distinguish between:
- Processing a floor once (legitimate)
- Processing a floor repeatedly (infinite loop)

### Attempt #3: Check if Route Length Changed ❌

**Attempted Check:**
```typescript
const routeLengthBefore = route.length();
this.getOrderedStops(...);
if (route.length() === routeLengthBefore && route.length() > 0) {
    throw new BUGBUG('Route not consumed', ...);
}
```

**Problem:** `ElevatorRoute.visitNow()` can add conditional floors while removing the current floor:
```typescript
visitNow(floor: Floor): boolean {
    // Remove the floor
    this.route.delete(floor);
    
    // But also add any conditional floors that were waiting
    for (const cf of item.visitAfter) {
        this.addRide(Number(cf)); // Adds new floors!
    }
}
```

**Result:** Route length can:
- Decrease (normal case)
- Stay the same (1 removed, 1 added)
- Increase (1 removed, 2+ added)

So checking route length doesn't work!

### Final Solution: Iteration Count Limit ✅

**The Check:**
```typescript
let iterationCount = 0;
const maxIterations = 1000;

while (!done && currentFloor !== targetFloor && route.length() > 0) {
    await new Promise(resolve => setImmediate(resolve));
    this.getOrderedStops(route, currentFloor, targetFloor, wrappedStopEarly);

    if (++iterationCount > maxIterations) {
        throw new BUGBUG('Infinite loop detected: too many iterations', {
            currentFloor,
            targetFloor,
            routeLength: route.length(),
            stopsProcessed: stops.length,
            iterationCount,
            last10Stops: stops.slice(-10)
        });
    }
}
```

**Why This Works:**
- ✅ No false positives: legitimate scenarios never need 1000+ iterations
- ✅ Catches all infinite loops: any infinite loop will hit the limit
- ✅ Simple and robust: doesn't depend on route internals
- ✅ Good error message: includes diagnostic info

**Why 1000 iterations is reasonable:**
- Each iteration processes up to 10 stops (batch size)
- 1000 iterations = 10,000 stops maximum
- No real-world elevator system would have 10,000 stops
- If we hit this limit, something is definitely wrong

## Edge Cases Tested

### Legitimate Scenarios (Should NOT Throw)

1. **Start at floor 0, route contains [0]**
   - Processes floor 0 once
   - ✅ Works correctly

2. **Single stop at current floor**
   - Elevator at floor 5, route contains [5]
   - ✅ Works correctly

3. **Pickup at current floor (empty route)**
   - `batchedGetOrderedStops(route, 3, 3)`
   - Loop doesn't run (currentFloor === targetFloor)
   - ✅ Returns [] immediately

4. **Route with conditional floors**
   - `visitNow()` adds more floors than it removes
   - Route length increases
   - ✅ Continues processing correctly

5. **Long routes (25+ stops)**
   - Multiple batches
   - ✅ Processes all stops

### Bug Scenarios (SHOULD Throw)

1. **Hypothetical: getOrderedStops doesn't consume route**
   - Would loop forever with same route
   - ✅ Caught after 1000 iterations

2. **Hypothetical: getOrderedStops doesn't call callback**
   - currentFloor never updates
   - Route never changes
   - ✅ Caught after 1000 iterations

## Why We Need the Check

Even though the `done` flag fixes the known bug, we still need the iteration count check because:

1. **Defense in depth:** Protects against unknown bugs in strategy implementations
2. **Clear error messages:** If something goes wrong, we get a helpful error instead of hanging
3. **Fail fast:** Better to throw an error than consume infinite CPU/memory
4. **Future-proof:** New strategies might have bugs we haven't thought of

## Test Coverage

Added 3 edge case tests to verify no false positives:
- ✅ Starting at floor 0 with route [0]
- ✅ Single stop at current floor
- ✅ Pickup at current floor (empty route)

All 108 tests passing!

## Key Lessons

1. **Conditional floors complicate things:** Route length can increase, not just decrease
2. **False positives are worse than no check:** A check that throws on legitimate cases is worse than no check
3. **Simple is better:** Iteration count is simpler and more robust than analyzing route state
4. **Test edge cases:** Floor 0, current floor, empty routes - these expose bugs in detection logic
5. **Defense in depth:** Even with the `done` flag fix, keep a safety net

## Conclusion

The iteration count check is the right approach because:
- It's simple (just count iterations)
- It's robust (no false positives)
- It's defensive (catches any infinite loop, known or unknown)
- It provides good diagnostics (includes all relevant state in error)

