/**
 * Pino-backed server logger. Imported only from `*.server.ts` files so the
 * pino dependency never touches the client bundle.
 *
 * Conformance: rule .claude/rules/observability.md (redaction at the sink).
 */
import { dev } from '$app/environment';
import pino from 'pino';
import type { AppLogger } from './index.js';

const instance = pino({
	level: dev ? 'debug' : 'info',
	redact: {
		paths: [
			'req.headers.cookie',
			'req.headers.authorization',
			'*.token',
			'*.accessToken',
			'*.refreshToken',
			'*.sid'
		],
		censor: '[REDACTED]'
	}
});

export const serverLogger: AppLogger = {
	debug: (obj, msg) => instance.debug(obj, msg),
	info: (obj, msg) => instance.info(obj, msg),
	warn: (obj, msg) => instance.warn(obj, msg),
	error: (obj, msg) => instance.error(obj, msg)
};
