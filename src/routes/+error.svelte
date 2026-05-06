<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$core/i18n';
</script>

<section class="space-y-3" role="alert" aria-live="assertive">
	<h2 class="text-2xl font-bold">{m.error_generic_title()}</h2>
	<p class="text-slate-700">
		<strong>{page.status}</strong>
		— {page.error?.message ?? m.error_generic_body()}
	</p>
	{#if page.error?.requestId}
		<p class="text-sm text-slate-500">
			{m.error_request_id({ id: page.error.requestId })}
		</p>
	{/if}
</section>
