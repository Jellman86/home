import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
            // default options are shown. On some platforms
            // these options are set automatically — see below
            pages: 'build',
            assets: 'build',
            fallback: '404.html', // Fallback for SPA mode if needed, or null for pure static
            precompress: false,
            strict: true
        }),
        paths: {
            // If the env var is set (e.g. in GitHub Actions), use it.
            // Otherwise, default to '' for local development.
            // CAUTION: For GitHub Pages project sites, this usually needs to be '/repo-name'.
            base: process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : '',
            relative: false
        }
	}
};

export default config;