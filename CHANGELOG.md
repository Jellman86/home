# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Blueprint Sky Cycle Toggle**: Added a dedicated Blueprint control to switch between overlay-heavy Blueprint backgrounds and full sky-cycle rendering.
- **Day/Night Sky Shader**: Added a procedural skybox cycle with night-gated stars and atmospheric transitions.
- **Milky Way Band Pass**: Added a diagonal Milky Way lane with clustered density, dust-lane attenuation, and bright/dark side asymmetry for a more natural galactic look.
- **Theme-State Background Remounting**: Added sky-mode-aware boid layer remounting to ensure clean transitions when toggling sky-cycle mode.
- **Terminal Observation Escalation**: Added observer recruitment escalation under typing pressure, including shake/flash behavior ramps.

### Fixed
- **Sky Toggle Restore Path**: Fixed Blueprint sky toggle state so disabling sky-cycle reliably restores the normal Blueprint background layers.
- **Observer/UI Collision**: Fixed observer boids clipping into or bouncing off terminal UI bounds in terminal mode.
- **Observer Orientation and Depth**: Fixed observer-facing logic so looming boids orient toward the interaction center and hold closer camera-relative depth.
- **Light-Mode Predator Visibility**: Fixed predator color washout in Blueprint light mode by forcing clear blood-red rendering where appropriate.
- **Sky-Cycle Day Coloring**: Fixed sky-cycle day-phase color handling so predator and prey boids shift to dark gray only during daytime while sky-cycle mode is active.

### Improved
- **Observer Motion Quality**: Smoothed observer drift, separation behavior, and approach pacing for less jitter and more intentional looming.
- **Skybox Composition**: Reduced uniform star-field noise and emphasized diagonal structure to better match real-sky references.
- **Theme Consistency**: Unified predator/prey appearance rules across Blueprint dark/light and sky-cycle day/night phases.
