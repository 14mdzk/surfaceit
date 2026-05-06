/**
 * Logger entry point.
 *
 * Phase 1 ships a leveled console wrapper so consumers (server and client)
 * have a single API to depend on. The server-side pino sink lives behind
 * `core/logger/pino.server.ts` and is only imported from `*.server.ts` files
 * (currently `hooks.server.ts`).
 *
 * Conformance: rule .claude/rules/observability.md.
 *
 * TODO(phase-2): replace the console wrapper with a production-grade client
 * logger that ships errors to the observability sink, and finalize the redact
 * paths on the pino sink.
 */
import { dev } from '$app/environment';

export interface AppLogger {
	debug(obj: object, msg: string): void;
	info(obj: object, msg: string): void;
	warn(obj: object, msg: string): void;
	error(obj: object, msg: string): void;
}

const ORDER = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof ORDER)[number];

function makeConsoleLogger(level: Level): AppLogger {
	const enabled = (lvl: Level) => ORDER.indexOf(lvl) >= ORDER.indexOf(level);
	return {
		debug: (o, m) => {
			if (enabled('debug')) console.debug(m, o);
		},
		info: (o, m) => {
			if (enabled('info')) console.info(m, o);
		},
		warn: (o, m) => {
			if (enabled('warn')) console.warn(m, o);
		},
		error: (o, m) => {
			console.error(m, o);
		}
	};
}

let cached: AppLogger | null = null;

/** Returns a process-wide logger. Same API on server and client. */
export function getLogger(): AppLogger {
	if (cached) return cached;
	cached = makeConsoleLogger(dev ? 'debug' : 'info');
	return cached;
}
