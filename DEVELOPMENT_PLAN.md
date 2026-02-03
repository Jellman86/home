# Development Plan: Personal Homepage

## Vision
A high-performance, visually stunning personal landing page acting as a central hub for your professional identity. The site will feature a modern, minimalist aesthetic with a sophisticated WebGL-based Boid simulation running in the background, utilizing the latest web technologies.

## Technology Stack ("The Modern Methodology")
To align with your preference for Svelte 5 in YA-WAMF and current industry best practices, we will use:

*   **Framework:** **SvelteKit** (Adapter Static)
    *   Utilizes **Svelte 5 Runes** for state management.
    *   Server-Side Generation (SSG) for instant load times on GitHub Pages.
*   **Language:** **TypeScript** (Strict mode)
*   **Styling:** **TailwindCSS**
    *   Utility-first for rapid, maintainable design.
    *   Glassmorphism effects to overlay content on the WebGL background.
*   **Graphics/WebGL:** **Three.js**
    *   Industry standard for WebGL.
    *   We will implement a custom **Compute Shader** or **InstancedMesh** Boid simulation for maximum performance (supporting thousands of boids without CPU bottlenecks).
*   **Deployment:** **GitHub Actions** (Automated build & deploy to GitHub Pages).

## Architecture

### 1. The Boid Simulation (Background)
*   **Visual Style:** Geometric abstract shapes (e.g., paper airplanes or tetrahedrons) or glowing particles.
*   **Behavior:** Flocking rules (Alignment, Cohesion, Separation) + Mouse interaction (predator/repulsion effect).
*   **Performance:**
    *   Use `InstancedMesh` to render all boids in a single draw call.
    *   Run physics calculations in a custom shader (GPGPU) or WebWorker if complexity increases, ensuring the main thread stays free for UI scrolling.

### 2. UI Layer (Foreground)
*   **Hero Section:** Brief "Blurb" / Bio with typed text effect or fade-in animation.
*   **Projects Grid:**
    *   Glassmorphic cards (frosted blur effect) to let the simulation peek through.
    *   Hover effects: Tilt/Parallax or glow.
    *   Data driven: Projects stored in a simple `projects.json` or `ts` file for easy updates.
*   **Social Links:** Minimalist icons (LinkedIn, GitHub, Email) with magnetic hover effects.

## Phase Breakdown

### Phase 1: Scaffolding & Infrastructure
*   Initialize SvelteKit project with TypeScript.
*   Configure TailwindCSS.
*   Update GitHub Actions workflow to handle Node.js build steps (install -> build -> deploy).

### Phase 2: The Boid Engine
*   Set up Three.js canvas layer (z-index: -1).
*   Implement basic Boid logic (separation, alignment, cohesion).
*   Optimize rendering using InstancedMesh.
*   Add mouse interaction capabilities.

### Phase 3: UI & Content Implementation
*   Build the responsive layout skeleton.
*   Create the "Glass Card" component for projects.
*   Populate content (Bio, Links, Projects).
*   Implement Svelte 5 runes for UI state (e.g., active theme, hover states).

### Phase 4: Polish & Performance
*   Lighthouse audit (aiming for 100/100/100/100).
*   Accessibility check (ensure contrast ratios are sufficient over the dynamic background).
*   SEO meta tags (Open Graph images, descriptions).

## Deployment Strategy
The existing GitHub Actions workflow will be updated to:
1.  Checkout code.
2.  Install dependencies (`npm ci`).
3.  Build the SvelteKit site (`npm run build`).
4.  Deploy the resulting `build/` directory to GitHub Pages.
