# 🌐 Personal Portfolio - Scott Powdrill

This repository contains the source code for my personal portfolio website, hosted at [pownet.uk](https://pownet.uk).

It is a high-performance, interactive experience built with modern web technologies, designed to showcase my work as an Infrastructure Engineer and my interest in the intersection of technology and nature.

## 📌 Current Project Status

The boid/sky systems have been heavily refined and are now in an advanced state:

*   **Blueprint Sky-Cycle Mode** is live, with reliable toggle behavior between standard Blueprint overlays and full day/night sky rendering.
*   **Terminal Observer Behavior** is now deliberately unsettling: observer boids recruit around the terminal perimeter, hold spacing, orient toward interaction focus, and escalate with typing activity.
*   **Skybox Work** now includes night-only stars and a diagonal Milky Way-style band with clustered structure and light/shadow asymmetry.
*   **Contextual Boid Coloring** is implemented for key modes:
    *   Blueprint light mode forces clear predator blood-red rendering when not in sky-cycle mode.
    *   In sky-cycle mode daytime, predator and prey shift to darker gray tones.

## ✨ Features

*   **Galaxy Simulation**: Stars orbit in a fixed galactic potential on the GPU, with irregular blue star-forming arms, pink gas knots, a warm bulge and shared dust extinction. A bounded 60Hz simulation clock keeps ages and the spiral pattern together; HDR light is tone-mapped once. Phones get a dedicated sky above the card. Minimise the panel to see the complete galaxy. Reduced motion and a seeded fallback are supported (WebGL2 required).
*   **3D Boid Simulation**: A custom-built Boid flocking simulation using `Three.js` and `InstancedMesh`. It replaces the galaxy while the YA-WAMF link has focus, and is the whole background of the Terminal theme.
    *   **Observer Effect**: In terminal mode, observer boids drift into perimeter positions around the terminal and progressively intensify while the user types.
    *   **Creeping Escalation**: Observer groups add controlled shake/flash cues over sustained typing to increase tension.
    *   **Predator Logic**: A predator entity that hunts the flock with smooth steering behaviors (Reynolds Steering).
    *   **Mode-Aware Color Logic**: Predator/prey palettes adapt to Blueprint light and sky-cycle day/night phases.
    *   **Trails System**: Visual trail rendering for boids and the predator to visualize flow dynamics.
    *   **Optimized Performance**: Capable of rendering hundreds of agents at 60FPS.
*   **"Blueprint" Theme**: A technical, CAD-inspired UI with:
    *   **Dark & Light Modes**: Seamless switching between a deep blue/slate aesthetic and a clean technical white style.
    *   **Draggable Interface**: The main "About Me" window is fully interactive and draggable.
    *   **Visual Diagnostics**: Animated radar dials, scanning lines, and data streams.
    *   **Sky-Cycle Toggle**: Optional day/night skybox mode with night-gated stars and a stylized Milky Way lane.
    *   **Parallax Background**: Dynamic grid and UI overlays for classic Blueprint mode.
*   **"Terminal" Theme**: A retro-style CLI interface with interactive commands.
    *   **Command History**: Navigate previous commands using Up/Down arrow keys.
    *   **Secure Handshake**: AES-256-GCM encrypted payload decryption via file upload.

## ⌨️ Terminal Easter Eggs

Explore the Terminal OS by typing these commands:
*   `help`: View available system commands.
*   `ls` / `ll`: List portfolio projects in a technical data format.
*   `cat bio.txt`: Read the system bio.
*   `whoami`: Display current session user.
*   `neofetch`: Show system specifications with a custom ASCII avatar.
*   `pownet`: Display the UK Infrastructure Engine branding.
*   `cowsay [message]`: Make a cow say something.
*   `sl`: Run the steam locomotive.
*   `date`: Get current system time.
*   `./upload-file.sh`: Initiate the secure decryption handshake for the CV payload.
*   `./send-message.sh [msg]`: Send an encrypted message to the administrator (requires authentication).

## 🛠️ Tech Stack

*   **Framework**: [SvelteKit](https://kit.svelte.dev/) (Static Site Generation)
*   **Language**: TypeScript
*   **Styling**: TailwindCSS 4
*   **Graphics**: [Three.js](https://threejs.org/) (WebGL)
*   **Security**: Web Crypto API (AES-256-GCM)
*   **Deployment**: GitHub Actions -> GitHub Pages (Custom Domain)

## 🤖 AI Agents & Skills
This project was co-authored with the assistance of AI agents using specialized skills:
*   **Frontend Design**: For crafting the distinctive "Blueprint" aesthetic and avoiding generic templates.
*   **Algorithmic Art**: For tuning the Boid flocking behaviors and simulation logic.

## 📄 License
MIT
