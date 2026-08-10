<svelte:head>
	<title>Plex connected | Auspex</title>
	<meta
		name="description"
		content="Plex approval is complete. Return to Auspex to choose your server."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<div class="signal" aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
		<div class="mark">A</div>
	</div>

	<section aria-labelledby="completion-title">
		<p class="eyebrow">Plex approval received</p>
		<h1 id="completion-title">Return to Auspex.</h1>
		<p class="body-copy">
			Auspex is finishing the secure connection and checking which Plex Media Servers are
			available to this account.
		</p>
		<div class="handoff">
			<span class="status-dot" aria-hidden="true"></span>
			<span>You can close this window.</span>
		</div>
	</section>

	<footer>Auspex keeps the Plex token in your device Keychain.</footer>
</main>

<style>
	:global(html) {
		background: #071421;
	}

	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at 75% 18%, rgba(77, 154, 214, 0.16), transparent 30rem),
			linear-gradient(145deg, #071421, #0b1c2d 62%, #10283a);
		color: #e7f1f7;
		font-family: 'Space Grotesk', system-ui, sans-serif;
	}

	main {
		box-sizing: border-box;
		min-height: 100svh;
		display: grid;
		grid-template-columns: minmax(12rem, 19rem) minmax(0, 34rem);
		grid-template-rows: 1fr auto;
		align-items: center;
		justify-content: center;
		gap: clamp(2.5rem, 8vw, 7rem);
		padding: clamp(2rem, 7vw, 6rem);
	}

	.signal {
		position: relative;
		width: min(62vw, 18rem);
		aspect-ratio: 1;
		display: grid;
		place-items: center;
	}

	.signal > span {
		position: absolute;
		inset: calc(var(--ring, 0) * 2.6rem);
		border: 1px solid rgba(113, 191, 236, calc(0.42 - var(--ring, 0) * 0.1));
		border-radius: 50%;
	}

	.signal > span:nth-child(1) { --ring: 0; }
	.signal > span:nth-child(2) { --ring: 1; }
	.signal > span:nth-child(3) { --ring: 2; }

	.mark {
		position: relative;
		width: 4.6rem;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px solid rgba(161, 219, 248, 0.8);
		border-radius: 1.25rem;
		background: rgba(16, 43, 62, 0.88);
		box-shadow: 0 0 3rem rgba(64, 170, 231, 0.26);
		font-family: 'JetBrains Mono', monospace;
		font-size: 2rem;
		font-weight: 700;
		color: #a1dbf8;
	}

	section {
		max-width: 34rem;
	}

	.eyebrow {
		margin: 0 0 1.25rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #71bfec;
	}

	h1 {
		margin: 0;
		font-size: clamp(3.1rem, 8vw, 6.4rem);
		font-weight: 500;
		line-height: 0.92;
		letter-spacing: -0.065em;
		text-wrap: balance;
	}

	.body-copy {
		max-width: 31rem;
		margin: 2rem 0;
		font-size: clamp(1.05rem, 2vw, 1.25rem);
		line-height: 1.65;
		color: #b7cad6;
	}

	.handoff {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.8rem 1rem;
		border: 1px solid rgba(113, 191, 236, 0.32);
		border-radius: 0.75rem;
		background: rgba(8, 28, 43, 0.62);
		font-size: 0.92rem;
		color: #d9eaf3;
	}

	.status-dot {
		width: 0.55rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: #70d7aa;
		box-shadow: 0 0 0.85rem rgba(112, 215, 170, 0.72);
	}

	footer {
		grid-column: 1 / -1;
		justify-self: center;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		color: #6f8797;
		text-align: center;
	}

	@media (max-width: 700px) {
		main {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto 1fr;
			align-content: center;
			gap: 2rem;
			padding: 2rem 1.5rem;
		}

		.signal {
			width: min(55vw, 12rem);
			justify-self: center;
		}

		.signal > span {
			inset: calc(var(--ring, 0) * 1.8rem);
		}

		.mark {
			width: 3.5rem;
			border-radius: 1rem;
			font-size: 1.55rem;
		}

		h1 {
			font-size: clamp(3rem, 16vw, 4.8rem);
		}

		footer {
			align-self: end;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.signal > span {
			animation: settle 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
			animation-delay: calc(var(--ring, 0) * 90ms);
		}

		@keyframes settle {
			from { opacity: 0; transform: scale(0.72); }
			to { opacity: 1; transform: scale(1); }
		}
	}
</style>
