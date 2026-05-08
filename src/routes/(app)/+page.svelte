<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$core/i18n';

	let { data } = $props();

	/**
	 * Read the csrf cookie value for the double-submit logout form.
	 * The csrf cookie is explicitly not HttpOnly so JS can read it.
	 */
	function getCsrfToken(): string {
		if (typeof document === 'undefined') return '';
		const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]*)/);
		return match ? decodeURIComponent(match[1]) : '';
	}
</script>

<section class="space-y-4">
	<h2 class="text-2xl font-bold">{m.hello({ name: data.user.email })}</h2>
	<p class="text-slate-600">
		Signed in as <strong>{data.user.email}</strong> ({data.role})
	</p>

	<!--
		use:enhance injects the CSRF token into formData at submit time — after
		hydration is guaranteed. The hidden `_csrf` input is NOT used because its
		value would be empty if the button is clicked before $effect runs.

		The submit callback reads the cookie synchronously at click time, appends
		it to the FormData, then returns undefined to let SvelteKit proceed with
		a full navigation (no client-side interception).
	-->
	<form
		method="POST"
		action="/logout"
		use:enhance={({ formData }) => {
			formData.set('_csrf', getCsrfToken());
			// Return undefined — SvelteKit falls back to full navigation.
		}}
	>
		<button
			type="submit"
			class="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
		>
			Sign out
		</button>
	</form>
</section>
