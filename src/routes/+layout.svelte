<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { m, locales, localeCookieName } from '$core/i18n';

	let { children, data } = $props();

	function setLocale(next: string) {
		document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000; samesite=lax`;
		location.reload();
	}
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-white text-slate-900">
	<header class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
		<h1 class="text-lg font-semibold">{m.app_title()}</h1>
		<label class="flex items-center gap-2 text-sm">
			<span class="sr-only">{m.locale_switch_label()}</span>
			<select
				aria-label={m.locale_switch_label()}
				data-testid="locale-switch"
				class="rounded border border-slate-300 px-2 py-1"
				value={data.locale}
				onchange={(e) => setLocale((e.currentTarget as HTMLSelectElement).value)}
			>
				{#each locales as code (code)}
					<option value={code}>{code.toUpperCase()}</option>
				{/each}
			</select>
		</label>
	</header>
	<main class="px-6 py-8">
		{@render children()}
	</main>
</div>
