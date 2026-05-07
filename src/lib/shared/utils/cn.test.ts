import { describe, it, expect } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
	it('concatenates multiple class strings', () => {
		expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
	});

	it('handles conditional classes — truthy value included', () => {
		const enabled: boolean = true;
		expect(cn('base', enabled && 'extra')).toBe('base extra');
	});

	it('handles conditional classes — falsy value excluded', () => {
		const enabled: boolean = false;
		expect(cn('base', enabled && 'extra')).toBe('base');
		expect(cn('base', null)).toBe('base');
		expect(cn('base', undefined)).toBe('base');
	});

	it('prunes undefined, null, and false from the output', () => {
		expect(cn(undefined, null, false, '', 'visible')).toBe('visible');
	});

	it('resolves conflicting Tailwind classes — last wins', () => {
		// padding conflict: px-2 is overridden by px-4
		expect(cn('px-2', 'px-4')).toBe('px-4');
	});

	it('resolves conflicting Tailwind color classes — last wins', () => {
		expect(cn('text-sm text-red-500', 'text-blue-500')).toBe('text-sm text-blue-500');
	});

	it('preserves non-conflicting classes when merging', () => {
		// py-1 is not a conflict with px-4
		expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
	});

	it('handles object syntax (clsx feature)', () => {
		expect(cn({ 'font-bold': true, 'font-normal': false })).toBe('font-bold');
	});

	it('handles array syntax (clsx feature)', () => {
		expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1');
	});

	it('returns empty string when no inputs', () => {
		expect(cn()).toBe('');
	});
});
