import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		alias: {
			$core: 'src/lib/core',
			'$core/*': 'src/lib/core/*',
			$shared: 'src/lib/shared',
			'$shared/*': 'src/lib/shared/*',
			$domains: 'src/lib/domains',
			'$domains/*': 'src/lib/domains/*',
			$server: 'src/lib/server',
			'$server/*': 'src/lib/server/*',
			$generated: 'src/lib/generated',
			'$generated/*': 'src/lib/generated/*',
			$routes: 'src/routes',
			'$routes/*': 'src/routes/*',
			$messages: 'src/lib/generated/paraglide/messages.js',
			'$messages/*': 'src/lib/generated/paraglide/*'
		}
	}
};

export default config;
