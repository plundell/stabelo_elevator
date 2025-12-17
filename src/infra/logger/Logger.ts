const DEFAULT_LOG_LEVEL = 'debug';
const LogLevels = {
	'debug': {
		level: 3,
		fn: console.debug,
		color: "\x1b[36m",
	},
	'info': {
		level: 2,
		fn: console.log,
		color: "\x1b[32m",
	},
	'warn': {
		level: 1,
		fn: console.warn,
		color: "\x1b[33m",
	},
	'error': {
		level: 0,
		fn: console.error,
		color: "\x1b[31m",
	},
}

function getLevel(level: keyof typeof LogLevels | number): number {
	if (typeof level === 'number') {
		if (level < 0) {
			return 0;
		}
		if (level > 3) {
			return 3;
		}
		return level;
	}
	return LogLevels[level].level;
}

export class Logger {
	static instances = new Map<Logger, number>();
	static setAllLogLevels(level: keyof typeof LogLevels | number): void {
		for (const logger of Logger.instances.keys()) {
			logger.setLogLevel(level);
		}
	}
	static resetAllLogLevels(): void {
		for (const logger of Logger.instances.keys()) {
			logger.setLogLevel(Logger.instances.get(logger) ?? DEFAULT_LOG_LEVEL);
		}
	}
	private _lowestLevel: number = 0;
	get lowestLevel(): number {
		return this._lowestLevel;
	}
	set lowestLevel(level: number) {
		this._lowestLevel = level;
	}

	constructor(private readonly name?: string, lowestLevel: keyof typeof LogLevels | number = DEFAULT_LOG_LEVEL) {
		this.setLogLevel(lowestLevel);
		Logger.instances.set(this, this.lowestLevel);
	}



	// Alias for setLevel for consistency with other APIs
	setLogLevel(level: keyof typeof LogLevels | number): void {
		this.lowestLevel = getLevel(level);
	}

	private format(level: keyof typeof LogLevels, message: string): string {
		const nameTag = this.name ? `\x1b[35m[${this.name}]\x1b[0m ` : "";
		const levelTag = `\x1b[${LogLevels[level].color}[${level.toUpperCase()}]\x1b[0m`;
		return `${levelTag} ${nameTag}${message}`;
	}

	log(level: keyof typeof LogLevels, message: string, ...optionalParams: any[]): void {
		if (this.lowestLevel < getLevel(level)) {
			return;
		}
		LogLevels[level].fn(this.format(level, message), ...optionalParams);
	}

	debug = this.log.bind(this, 'debug');
	info = this.log.bind(this, 'info');
	warn = this.log.bind(this, 'warn');
	error = this.log.bind(this, 'error');
}


