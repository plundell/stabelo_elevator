import EventEmitter from "events";
import { Logger } from "../logger/Logger";

type AnyArgs = any;
/**
 * A map of events and their single argument.
 * 
 * @example
 * {
 *   'event1': arg1,
 *   'event2': arg2
 * }
 */
export type EventMap = Record<string, AnyArgs>;

const tag = (name: string | number | symbol) => `\x1b[31m[${String(name)}]\x1b[0m `

/**
 * A typed event emitter that allows for type-safe event emission and listening.
 * 
 * NOTE: Using symbols for events negates the type safety, but it will still compile.
 * 
 * @template T - The event map type.
 */
export class TypedEventEmitter<T extends EventMap> extends EventEmitter {

	constructor(public readonly logger?: Logger) {
		super();
	}
	/**
	 * Emit an event with a single argument.
	 * @param event - The event to emit.
	 * @param arg - The argument to emit.
	 * @returns True if the event was emitted, false otherwise.
	 */
	emit<K extends keyof T>(event: K | symbol, arg: T[K]): boolean {
		this.logger?.debug(`${tag(event)} ${JSON.stringify(arg)}`);
		return super.emit(event as string, arg);
	}

	/**
	 * Add a listener to an event
	 * @param event - The event to listen to.
	 * @param listener - The listener to add.
	 * @returns this
	 */
	on<K extends keyof T>(event: K | symbol, listener: (arg: T[K]) => void): this {
		this.logger?.debug(`Adding listener to event '${String(event)}'`);
		return super.on(event as string, listener);
	}

	/**
	 * Like {@link on()}, but this returns a callback which removes the listener
	 * @param event - The event to listen to.
	 * @param listener - The listener to add.
	 * @returns A function to remove the listener.
	 */
	listen<K extends keyof T>(event: K | symbol, listener: (arg: T[K]) => void): () => void {
		this.on(event, listener);
		return () => this.off(event, listener);
	}


	off<K extends keyof T>(event: K | symbol, listener: (arg: T[K]) => void): this {
		this.logger?.debug(`Removing listener from event '${String(event)}'`);
		return super.off(event as string, listener);
	}
}