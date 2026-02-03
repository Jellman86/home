# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.6] - 2026-02-03
### Added
- Dual-Layer WebGL Background system: optimized sky and sea rendering.
- Realistic Zenith sky gradient (Deep Prussian Blue to Cerulean).
- Sharpened high-altitude FBM cloud shader for a "standing position" perspective.
- "Side Slice" vertical ocean view with surface light scattering and deep zones.
- Rising bubble particle system for Fish mode.
- Black silhouette boids for Bird mode.

### Fixed
- Fixed mode-switching reactivity issues between Bird and Fish modes.
- Fixed boid "twitchiness" by implementing acceleration caps and smooth steering.
- Resolved toroidal vortex behavior in bird flocks by prioritizing alignment over cohesion.
- Improved boid visibility by optimizing camera distance and world boundaries.

## [1.1.0] - 2026-02-03


### Added
- **Framework:** Initialized project with **SvelteKit** using the latest **Svelte 5** syntax and **TypeScript**.
- **Visuals:** Implemented a high-performance **Three.js Boid Simulation** background using `InstancedMesh` for efficient rendering of 600+ particles.
- **Physics:** Implemented standard Boid flocking behaviors (Separation, Alignment, Cohesion) with interactive mouse repulsion.
- **Design:** Modern dark-themed hero landing page with Tailwind CSS v4, featuring glassmorphic UI elements and responsive layout.
- **Infrastructure:** Configured **GitHub Actions** for automated builds and static deployment to **GitHub Pages**.
- **Styling:** Set up **Tailwind CSS v4** with `@tailwindcss/postcss` integration.

### Fixed
- **Deployment:** Resolved GitHub Pages sub-directory asset paths by correctly configuring `paths.base` in `svelte.config.js`.
- **Styling:** Fixed Tailwind CSS v4 build errors by aligning PostCSS configuration and import syntax.
- **Visibility:** Fixed background canvas visibility by ensuring parent containers remained transparent.

### Changed
- Refined homepage content to focus on Infrastructure Engineering and current work-in-progress status.
