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
- **Lighting System**: Uses a global `AmbientLight` for base visibility, a dynamic `PointLight` that acts as a "sentience flashlight," and a `DirectionalLight` following the camera position to ensure no 3D boid is ever in total darkness.
- **Simulation Loop**: Running the Boid flocking and Predator pursuit algorithms.
- **Interactivity**: Responding to mouse movement and "Interaction Points" from the foreground.
- **Optimization**: Uses `InstancedMesh` with `MeshPhongMaterial` to render 300-800 boids with 3D shading and specular highlights in a single draw call.
- **Instanced Colors**: The `instanceColor` attribute must be bound to the geometry for per-boid coloring; normals should be recomputed after geometry rotation to ensure lighting works.
- **Color Space**: Renderer output uses sRGB + tone mapping; boid instance colors are converted to linear space before upload.

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

## 🧠 Simulation Algorithms

The background simulation is a custom implementation of several classic and novel steering behaviors.

### 1. Standard Boid Flocking (Prey)
Uses Craig Reynolds' Boids algorithm with a topological neighbor optimization:
- **Separation**: Avoids crowding by steering away from neighbors within `PROTECTED_RANGE`.
- **Alignment**: Steers towards the average heading of neighbors within `VISUAL_RANGE`.
- **Cohesion**: Steers towards the average position (center of mass) of neighbors.
- **Topological Neighbors**: Instead of checking every boid, each agent only considers its nearest `NEIGHBOR_COUNT` (default: 7) neighbors. This mimics real-world starlings and improves performance.

### 2. Predator Pursuit
The predator uses **Reynolds Steering** to hunt the flock:
- **Prediction**: It doesn't aim for where a boid is, but where it will be, using `PREDATOR_PREDICT_T` to calculate a future interception point.
- **Steering**: `Steer = DesiredVelocity - CurrentVelocity`. This creates a natural, physical turn radius instead of instant snapping.
- **Target Switching**: The predator selects a random target and pursues it until it either "kills" it (reaches `PREDATOR_KILL_RADIUS`) or a timer expires.

### 3. The Observer Effect (Looming)
When the user types, boids transition from the "Flock" state to the "Observer" state:
- **Recruitment Logic**: A `recruitmentLevel` variable increases slowly while typing (~25s to full assembly) and decays rapidly when idle (boredom effect), causing boids to rejoin the flock within seconds of inactivity.
- **Fibonacci Stationing**: Observers are distributed around the UI using a **Fibonacci Spiral** pattern. This ensures even spacing and prevents boids from clumping in a single spot.
- **Screen-to-World Mapping**:
    - Target positions are calculated in screen-space (relative to the Terminal window).
    - These are converted to **Normalized Device Coordinates (NDC)**.
    - Finally, they are `unprojected` using the camera to find their absolute 3D position in the WebGL scene.
- **3D Depth Layering**: Observers are assigned to 6 distinct depth planes (`ndcZ`), creating a voluminous surrounding effect rather than a flat ring.
- **Gaze Focus**: Once stationary, boids use `Object3D.lookAt` to point their "heads" (the tip of the cone geometry) at the precise 3D point corresponding to the user's typing cursor.
- **Sentience Flashlight**: A `PointLight` is dynamically positioned at the `typingPoint`. This ensures that as boids loom around the terminal, they are physically illuminated by the "energy" of the user's input, enhancing the sense of scrutiny.

## ⚠️ Things to Avoid

1.  **Direct DOM Manipulation**: Avoid using `document.getElementById`. Use Svelte's `bind:this` for the canvas and container.
2.  **Local Builds for Production**: Never run `npm run build` locally for production. Let the GitHub Action handle it to ensure the `__GIT_HASH__` is injected correctly from the CI environment.
3.  **Heavy Shaders**: The background already uses a complex fragment shader for the skybox and clouds. Be mindful of adding further GPU load that might impact the 60FPS target on mobile devices.
4.  **Mixing Syntax**: Stick strictly to Svelte 5 syntax. Avoid using `onMount` for logic that can be handled by `$effect`.

## 🛠️ Tooling
- **`gh` CLI**: Use this to check build statuses (`gh run list`).
- **Vite `define`**: Used to pass server-side or build-time data (like the git hash) to the client-side code.
- **Diagnostics System**: A built-in tool accessible via the UI to debug WebGL state. It logs buffer data and overrides materials to isolate geometry, lighting, and attribute issues.
