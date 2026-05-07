import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names, resolving conflicts so the last value wins.
 *
 * Usage:
 *   cn('px-2 py-1', 'px-4')          → 'py-1 px-4'
 *   cn('text-sm', isLarge && 'text-lg') → 'text-lg' (or 'text-sm' if isLarge is falsy)
 *
 * Rule: styling.md — `cn(...)` is the single class-merger in this codebase.
 * Combines clsx (conditional class handling) with tailwind-merge (conflict resolution).
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
