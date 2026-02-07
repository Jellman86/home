# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **3D Shaded Entities**: Upgraded boids from flat icons to lit 3D objects using `MeshPhongMaterial`.
- **Dynamic Flashlight**: Implemented a `PointLight` that tracks the user's typing point, providing real-time 3D highlights on the looming swarm.
- **Observer Effect**: Implemented "Voyeur" boids that break away from the main flock when the user interacts with the terminal.
- **Stationary Looming**: Observers now calculate fixed stations around the UI perimeter and remain still to focus on the user.
- **3D Depth Layering**: Observers are distributed across multiple 3D planes to create a voluminous surrounding effect.
- **Dynamic Git Hash**: Added build-time injection of the actual git commit hash into the UI footer.
- **Avatar Avoidance**: Specific logic to ensure boids do not obstruct the user's avatar area.

### Fixed
- **Boid Syntax Errors**: Resolved multiple syntax errors in the animation loop that were causing build failures.
- **Interaction Triggers**: Fixed a bug where boids would loom on initial page load; they now only react to active typing.
- **Boredom Decay**: Adjusted recruitment and departure rates for more organic transitions.

### Improved
- **Species Variation**: Introduced non-uniform sizing for boids to better reflect natural biological diversity.
- **Vite Configuration**: Enhanced `vite.config.ts` to support dynamic environment constants.
