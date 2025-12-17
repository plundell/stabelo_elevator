import { Logger } from "../../../infra/logger/Logger";
import { Command } from "commander";

export abstract class BaseCommand {
	protected logger: Logger;

	constructor(logger?: Logger) {
		this.logger = logger ?? new Logger(this.constructor.name);
	}

	abstract register(cli: Command): void;
}