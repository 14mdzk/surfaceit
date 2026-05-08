<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$core/i18n';

	let { form } = $props();
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
		<h1 class="text-xl font-semibold text-slate-900">{m.auth_login_title()}</h1>

		{#if form?.error}
			<p class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
				{m[form.error]?.() ?? m.auth_login_error_generic()}
				{#if form.requestId}
					<span class="mt-1 block text-xs text-red-500"
						>{m.error_request_id({ id: form.requestId })}</span
					>
				{/if}
			</p>
		{/if}

		<form method="POST" use:enhance class="space-y-4">
			<div class="space-y-1">
				<label for="email" class="block text-sm font-medium text-slate-700">
					{m.auth_login_email_label()}
				</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					placeholder={m.auth_login_email_placeholder()}
					class="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
				/>
			</div>

			<div class="space-y-1">
				<label for="password" class="block text-sm font-medium text-slate-700">
					{m.auth_login_password_label()}
				</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:outline-none"
			>
				{m.auth_login_submit()}
			</button>
		</form>
	</div>
</div>
