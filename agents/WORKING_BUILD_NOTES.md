# Working Build Notes (Known Issues)

This repo is currently pinned to a "known working" baseline build (see recent `revert:` commits on `main`).

The site is stable to run and deploy, but the following issues were identified during a full code review
and should be treated as follow-up work (some are security-relevant):

- AES-GCM IV reuse in the Terminal theme encryption/decryption path (must use a unique IV per ciphertext).
- `target="_blank"` links missing `rel="noopener noreferrer"` (reverse-tabnabbing).
- `npm run check` fails due to TypeScript/Svelte-check issues (should be restored as a reliable gate).
- `BoidBackground` adds global event listeners without removing them on destroy (potential leaks on remount).
- Terminal input uses `autofocus` and has a few Svelte 5 ref-reactivity warnings.

As fixes land, keep this file updated with the current "known good" build hash and any remaining risks.

