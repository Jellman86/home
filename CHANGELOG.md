# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-03

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
