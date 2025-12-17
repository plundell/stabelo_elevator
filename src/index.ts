#!/usr/bin/env node

import dotenv from 'dotenv';
import { Logger } from './infra/logger/Logger';
import { CliApi } from './api/cli';
// import { startHttpServer } from './api/http';
import { getUsageMessage } from './api/cli/usage';
import { Application } from './app/app';
import { defaultOptions, parseOptions } from './options';

// Load environment variables and merge them with default options, making
// sure they're immutable from now on.
dotenv.config({ path: '.env' });
const options = Object.freeze(parseOptions(process.env, defaultOptions));


// Create a logger for the main application
const logger = new Logger('Main', options.LOG_LEVEL);



// Determine the running mode and command arguments
const args = [...process.argv];
const eatFlag = (args: string[], flag: string): boolean => {
	const index = args.indexOf(flag);
	if (index !== -1) {
		args.splice(index, 1);
		return true;
	}
	return false;
}
const shouldStartHttp = eatFlag(args, '--http');
const shouldStartCli = eatFlag(args, '--cli');
const runOnetimeCommand = args.length > 2; //if any args are left that'll be a command



// Start the core application which will continue running until the process is killed.
const app = new Application(options, new Logger('App', options.LOG_LEVEL));
app.start().catch((error) => {
	logger.error('Failed to start application:', error);
	process.exit(1);
});



if (runOnetimeCommand) {
	//forbidden to use command arguments with --cli or --http flags
	if (shouldStartCli || shouldStartHttp) {
		logger.error(getUsageMessage());
		logger.error('Cannot use command arguments with --cli or --http flags.');
		process.exit(1);
	}
	(new CliApi(app)).run(args, false).catch((error) => { //false means don't keep the process alive
		console.error(error);
		process.exit(1);
	}).finally(() => {
		process.exit(0);
	});

} else if (shouldStartCli || shouldStartHttp) {
	//if either flag is present we're going to run at least one service...

	if (shouldStartCli) {
		(new CliApi(app)).run(args, true).catch((error) => { //true means keep the process alive
			logger.error(error);
			// process.exit(1);
		});
	}

	// if (shouldStartHttp) {
	// 	startHttpServer();
	// 	if (shouldStartCli) {
	// 		console.log('HTTP server is running. Use CLI command to stop it.\n');
	// 	} else {
	// 		console.log('HTTP server is running. Press Ctrl+C to stop.\n');
	// 	}
	// }

	// Set up signal handlers for graceful shutdown (TODO)
	process.on('SIGINT', async () => {
		logger.info('ctrl+c...');
		await app.stop();
		process.exit(0);
	});

}
// else {
// 	//if nothing was passed in than we have a problem...
// 	logger.warn(usageMessage);
// 	logger.error('No running mode or command specified. The app would have started and ran doing nothing. Exiting...');
// 	process.exit(1);
// }
