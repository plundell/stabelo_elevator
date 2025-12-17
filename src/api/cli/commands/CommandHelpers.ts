import { ElevatorService } from '../../../domain/services/ElevatorService';

/**
 * Helper function to normalize elevator IDs in CLI commands.
 * 
 * This allows users to type shorthand like "#1", "1", or "#5" instead of 
 * the full "Elevator#1" or "Elevator#5". The actual elevator IDs remain 
 * unchanged in the system.
 * 
 * @param userInput - The user's input (e.g., "#1", "1", "Elevator#1")
 * @param elevatorService - The elevator service to validate against
 * @returns The full elevator ID (e.g., "Elevator#1") or null if not found
 * 
 * @example
 * normalizeElevatorId("#1", service) // returns "Elevator#1"
 * normalizeElevatorId("1", service)  // returns "Elevator#1"
 * normalizeElevatorId("Elevator#1", service) // returns "Elevator#1"
 */
export function normalizeElevatorId(
	userInput: string,
	elevatorService: ElevatorService
): string | null {
	// If the user already typed the full ID, verify it exists and return it
	const allElevatorIds = elevatorService.listElevators();
	if (allElevatorIds.includes(userInput)) {
		return userInput;
	}

	// Try to expand shorthand notation
	// Support formats like: "#1", "1", "#5", "5", etc.
	let expandedId: string;
	
	if (userInput.startsWith('#')) {
		// User typed "#1" -> expand to "Elevator#1"
		expandedId = `Elevator${userInput}`;
	} else if (/^\d+$/.test(userInput)) {
		// User typed just "1" -> expand to "Elevator#1"
		expandedId = `Elevator#${userInput}`;
	} else {
		// Unknown format, return null
		return null;
	}

	// Verify the expanded ID exists
	if (allElevatorIds.includes(expandedId)) {
		return expandedId;
	}

	// Not found
	return null;
}

/**
 * Get a user-friendly error message for an invalid elevator ID.
 * 
 * @param userInput - The user's input that was invalid
 * @param elevatorService - The elevator service to list available IDs
 * @returns A helpful error message
 */
export function getElevatorNotFoundMessage(
	userInput: string,
	elevatorService: ElevatorService
): string {
	const allIds = elevatorService.listElevators();
	const shortIds = allIds.map(id => id.replace('Elevator', ''));
	
	return `Elevator '${userInput}' not found. Available: ${shortIds.join(', ')}`;
}

