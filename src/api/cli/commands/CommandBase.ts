import { Logger } from "../../../infra/logger/Logger";
import { Command } from "commander";

export abstract class BaseCommand {
	protected logger: Logger;

	constructor(name: string) {
		this.logger = new Logger(name);
	}

	abstract register(cli: Command): void;
}