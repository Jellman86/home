# Developer Documentation - Pownet Portfolio

This document provides a technical overview of how the Pownet Portfolio site is constructed, the tech stack used, and the architectural patterns to follow.

## 🏗️ Architecture Overview

The site is built as a **SvelteKit** single-page application (SPA) optimized for static hosting. The visual experience is driven by a custom **Three.js** engine integrated directly into Svelte components via the lifecycle hooks.

### Core Tech Stack
- **Framework**: Svelte 5 (using Runes: `$state`, `$derived`, `$effect`).
- **3D Engine**: Three.js (using `InstancedMesh` for high-performance agent simulation).
- **Styling**: TailwindCSS 4 (using the `@theme` directive and modern CSS variables).
- **Build Tool**: Vite (with custom build-time constants for Git integration).
- **Deployment**: GitHub Actions (CI/CD) deploying to GitHub Pages.

## 🧩 Component Structure

### 1. The Background Layer (`BoidBackground.svelte`)
This is the heavy lifter. It manages:
- **WebGL Lifecycle**: Initializing the Scene, Camera, and Renderer.
- **Simulation Loop**: Running the Boid flocking and Predator pursuit algorithms.
- **Interactivity**: Responding to mouse movement and "Interaction Points" from the foreground.
- **Optimization**: Uses `InstancedMesh` to render 400-800 boids in a single draw call.

### 2. The Theme System
Located in `src/lib/components/themes/`, these components define the "personality" of the site:
- **Blueprint**: Uses `spring` motion for parallax effects and complex SVG corner markers.
- **Terminal**: A functional CLI emulator with custom command parsing and decryption logic.

## 🚀 Key Patterns & Conventions

### Svelte 5 Integration
The project leverages Svelte 5's **Runes** for reactivity:
- **`$state`**: Used for simulation parameters like `recruitmentLevel` and `typingPoint`.
- **`$effect`**: Used to bridge Svelte's reactive state with Three.js (e.g., updating fog color when the theme changes).
- **Binding**: FPS and other stats are bound from the child `BoidBackground` up to the root `+page.svelte`.

### Performance in the Loop
The `animate()` function runs ~60 times per second. To maintain performance:
- **Avoid `new`**: Never instantiate objects like `THREE.Vector3` or `THREE.Color` inside the `for` loop. Use pre-allocated "dummy" objects (prefixed with `_`).
- **Buffer Management**: Only set `needsUpdate = true` once per frame after all instances are updated.

## ⚠️ Things to Avoid

1.  **Direct DOM Manipulation**: Avoid using `document.getElementById`. Use Svelte's `bind:this` for the canvas and container.
2.  **Local Builds for Production**: Never run `npm run build` locally for production. Let the GitHub Action handle it to ensure the `__GIT_HASH__` is injected correctly from the CI environment.
3.  **Heavy Shaders**: The background already uses a complex fragment shader for the skybox and clouds. Be mindful of adding further GPU load that might impact the 60FPS target on mobile devices.
4.  **Mixing Syntax**: Stick strictly to Svelte 5 syntax. Avoid using `onMount` for logic that can be handled by `$effect`.

## 🛠️ Tooling
- **`gh` CLI**: Use this to check build statuses (`gh run list`).
- **Vite `define`**: Used to pass server-side or build-time data (like the git hash) to the client-side code.
