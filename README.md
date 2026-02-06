# 🌐 Personal Portfolio - Scott Powdrill

This repository contains the source code for my personal portfolio website, hosted at [pownet.uk](https://pownet.uk).

It is a high-performance, interactive experience built with modern web technologies, designed to showcase my work as an Infrastructure Engineer and my interest in the intersection of technology and nature.

## ✨ Features

*   **3D Boid Simulation**: A custom-built Boid flocking simulation using `Three.js` and `InstancedMesh`.
    *   **Predator Logic**: A predator entity that hunts the flock with smooth steering behaviors (Reynolds Steering).
    *   **Trails System**: Visual trail rendering for boids and the predator to visualize flow dynamics.
    *   **Optimized Performance**: Capable of rendering hundreds of agents at 60FPS.
*   **"Blueprint" Theme**: A technical, CAD-inspired UI with:
    *   **Dark & Light Modes**: Seamless switching between a deep blue/slate aesthetic and a clean technical white style.
    *   **Draggable Interface**: The main "About Me" window is fully interactive and draggable.
    *   **Visual Diagnostics**: Animated radar dials, scanning lines, and data streams.
    *   **Parallax Background**: Dynamic grid and starfield that responds to mouse movement.
*   **"Terminal" Theme**: A retro-style CLI interface with interactive commands.

## ⌨️ Terminal Easter Eggs

Explore the Terminal OS by typing these commands:
*   `help`: View available system commands.
*   `ls` / `ll`: List portfolio projects in a technical data format.
*   `cat bio.txt`: Read the system bio.
*   `whoami`: Display current session user.
*   `neofetch`: Show system specifications and Pownet OS info.
*   `pownet`: Display the UK Infrastructure Engine branding.
*   `cowsay [message]`: Make a cow say something.
*   `sl`: Run the (stationary) steam locomotive.
*   `date`: Get current system time.
*   `./upload-file.sh`: Initiate the secure decryption handshake for the CV payload.

## 🛠️ Tech Stack

*   **Framework**: [SvelteKit](https://kit.svelte.dev/) (Static Site Generation)
*   **Language**: TypeScript
*   **Styling**: TailwindCSS 4
*   **Graphics**: [Three.js](https://threejs.org/) (WebGL)
*   **Deployment**: GitHub Actions -> GitHub Pages (Custom Domain)

## 🤖 AI Agents & Skills
This project was co-authored with the assistance of AI agents using specialized skills:
*   **Frontend Design**: For crafting the distinctive "Blueprint" aesthetic and avoiding generic templates.
*   **Algorithmic Art**: For tuning the Boid flocking behaviors and simulation logic.

## 📄 License
MIT
