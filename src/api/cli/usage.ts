export function getUsageMessage(): string {
	// Detect if running via 'npm run dev' or 'npm start' to provide correct usage message
	const isNpmRunDev = process.env.npm_lifecycle_event === 'dev';
	const npmRunCmd = `npm ${isNpmRunDev ? 'run dev[:respawn]' : 'start'}`;

	return `
Stabelo Elevator

Usage:
  ${npmRunCmd}                      Show this help message
  ${npmRunCmd} help [command]       Show help for all or specific cli commands
  ${npmRunCmd} -- --cli             Start interactive CLI
  ${npmRunCmd} -- --http            Start HTTP server
  ${npmRunCmd} -- --http --cli      Start both HTTP server and interactiveCLI
`;
}

