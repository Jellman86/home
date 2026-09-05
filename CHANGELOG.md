# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Galaxy Background**: The page now rests on a simulated spiral galaxy rather than the flock. Tens of thousands of stars are integrated on the GPU every frame under a galactic potential (soft core, flat rotation curve) with a weak rotating spiral perturbation, so the inside turns faster than the rim and the arms are a density wave the stars stream through. Two populations: old stars orbit forever and are smooth; young stars are born on the arms, blue, and fade as they shear away. A baked nebula with dust lanes rotates with the pattern, a scrim pulls the page toward black, and a few spiky foreground stars sit in front. It does not react to the mouse.
- **YA-WAMF Background**: Hovering or keyboard-focusing the YA-WAMF link swaps the galaxy for the flock; leaving brings the galaxy back.
- **Optimisarr Project Link**: Added Optimisarr to the links list.
- **Per-Project Background Modes**: Hovering or keyboard-focusing the Optimisarr link resolves the flock into a macroblock grid, evoking a video encode, and eases back to boids on leave. Implemented as a render-time blend over the existing simulation, so the flock keeps running underneath and no second scene is needed.
- **Reduced-Motion Support**: Added `prefers-reduced-motion` handling so the boid simulation renders a single still frame instead of animating, and responds live when the preference changes.
- **Social Sharing Metadata**: Added Open Graph and Twitter card tags plus a canonical URL, so shared links render a card rather than a bare URL.
- **Blueprint Sky Cycle Toggle**: Added a dedicated Blueprint control to switch between overlay-heavy Blueprint backgrounds and full sky-cycle rendering.
- **Day/Night Sky Shader**: Added a procedural skybox cycle with night-gated stars and atmospheric transitions.
- **Milky Way Band Pass**: Added a diagonal Milky Way lane with clustered density, dust-lane attenuation, and bright/dark side asymmetry for a more natural galactic look.
- **Theme-State Background Remounting**: Added sky-mode-aware boid layer remounting to ensure clean transitions when toggling sky-cycle mode.
- **Terminal Observation Escalation**: Added observer recruitment escalation under typing pressure, including shake/flash behavior ramps.

### Changed
- **Default Background**: The flock is no longer the default. It appears for the YA-WAMF link, for Optimisarr (as macroblocks), and throughout the Terminal theme, where the observers are the point. Every hover background replaces the galaxy outright rather than layering over it; the Auspex creature arrives over an empty ground, and the old flock-into-squares morph is gone.
- **Light Theme Sky**: On the light Blueprint theme the galaxy is drawn as dark ink with normal blending and no nebula or scrim: a chart of the same galaxy on paper.
- **Blueprint Window Framing**: Reduced the Blueprint panel from three concentric frames to one. Removed the duplicate `0 0 0 1px` shadow ring, added rounded corners and a real drop shadow to match the Terminal window, and replaced the four protruding corner brackets with a single inset registration mark.

### Fixed
- **Safari Chrome**: The status bar and toolbar on iOS Safari (and any browser honouring `theme-color`) no longer render white. The viewport extends under the safe areas, the document background follows the theme, and a `theme-color` meta tag tracks it.
- **Mobile Toolbar Overlap**: Fixed the fixed diagnostics toolbar covering the portrait on narrow screens by giving the stacked visual column bottom clearance.
- **Sky Toggle Restore Path**: Fixed Blueprint sky toggle state so disabling sky-cycle reliably restores the normal Blueprint background layers.
- **Observer/UI Collision**: Fixed observer boids clipping into or bouncing off terminal UI bounds in terminal mode.
- **Observer Orientation and Depth**: Fixed observer-facing logic so looming boids orient toward the interaction center and hold closer camera-relative depth.
- **Light-Mode Predator Visibility**: Fixed predator color washout in Blueprint light mode by forcing clear blood-red rendering where appropriate.
- **Sky-Cycle Day Coloring**: Fixed sky-cycle day-phase color handling so predator and prey boids shift to dark gray only during daytime while sky-cycle mode is active.

### Improved
- **Larger, Fixed Galaxy**: Increased the desktop galaxy diameter by roughly 63%, widened its luminous arms and added diffuse inter-arm clouds. Its position and scale now depend only on the viewport, never on the panel's position or minimised state; mobile sky clearance is 270px.
- **Rare Sky Discoveries**: Added tiny alien craft, slowly approaching black-hole lenses and three faint distant galaxies. Encounters are isolated by 2–4½ minute quiet gaps and pause when hidden or reduced motion is enabled. Black holes arrive from the margin over 72 seconds with a small silhouette and much wider, gradually strengthening lensing. Added six scheduling/path/fixed-position checks (20 tests total).
- **Galaxy Detail and Framing**: Broadened and broken up the star-forming arms, added gas spurs and restrained HII knots, softened the warm bulge, and shared dust attenuation between gas and near/far-side stars. Linear HDR accumulation now receives one output tone-map. Mobile gets reserved sky space; minimising the panel opens a full-size galaxy view.
- **Galaxy Timing and Lifecycle**: Added a bounded 60Hz clock shared by stars, ages and the pattern, age-aware initial seeding, a static GPU-compute fallback, explicit target/material disposal, reduced-motion layout/theme refreshes, and 14 regression checks enforced before deployment.
- **Hidden Flock Budget**: The invisible flock now runs at 10Hz standby rather than full rate, with trail resets when it reappears. In local development CPU samples, its self-time share fell from 16.5% to 2.8%; this is not a mobile GPU benchmark.
- **Observer Motion Quality**: Smoothed observer drift, separation behavior, and approach pacing for less jitter and more intentional looming.
- **Skybox Composition**: Reduced uniform star-field noise and emphasized diagonal structure to better match real-sky references.
- **Theme Consistency**: Unified predator/prey appearance rules across Blueprint dark/light and sky-cycle day/night phases.
