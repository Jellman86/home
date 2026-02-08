import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execFileSync } from 'child_process';

function resolveGitHash(): string {
	// Prefer CI-provided SHA to avoid spawning git in constrained runtimes.
	const sha = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA;
	if (sha && sha.length >= 7) return sha.slice(0, 7);

	// Fallback to local git (no shell).
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
	} catch {
		return 'unknown';
	}
}

const gitHash = resolveGitHash();

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__GIT_HASH__: JSON.stringify(gitHash)
	}
});
