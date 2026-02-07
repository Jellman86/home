# Known Issues & Bug Tracking

## 🔴 [REOPENED] Observer Color Charge Invisibility & Black Boids

### Status Update (BUILD 59cca11)
Despite an exhaustive overhaul of the lighting system (Ambient, Directional, and Point lights) and switching to `MeshPhongMaterial`, boids appear as solid black silhouettes in the terminal view. The Predator boid works as expected (white), but the instanced flock does not receive or display color/light correctly.

### Status Update (FIX CANDIDATE)
Applied a concrete fix to the instanced flock pipeline:
- Bound `instanceColor` directly to the geometry attribute (`instanceColor`) to guarantee shader access.
- Recomputed cone normals after rotation to ensure lighting reacts correctly.
- Added a subtle emissive fallback tied to the theme color to prevent total blackout even if lighting/vertex colors fail.

**Next step:** Verify in terminal mode that boids are colored and illuminated (no black silhouettes).

### Root Cause Analysis (Revised)
1.  **InstancedMesh Normals**: `ConeGeometry` may require explicit normal computation or a specific orientation to react correctly to lights when instanced.
2.  **Color Buffer Override**: The `instanceColor` buffer might be initialized with zeros (black) and failing to update correctly in the GPU memory, overriding the material.
3.  **Lighting/Material Conflict**: There may be a conflict between `vertexColors: true` and the way `MeshPhongMaterial` calculates illumination on instanced geometry.

### Potential Fixes to Investigate
- Test with `MeshLambertMaterial` (cheaper, different lighting model).
- Verify the `instanceColor` buffer data types and usage flags.
- Try a non-lit material with manual color calculation to prove the buffer is working.

When boids enter the "Observer" state (looming around the terminal), they are intended to turn bright white/yellow to signal active scrutiny. However, in the current build, they remain their base color or appear dark/black during this transition.

### Context
- **Working Case**: The **Predator** boid color works perfectly. It updates its material color reactively when the theme changes.
- **Failing Case**: The **Instanced Boids** fail to show the individual chromatic charge applied via `setColorAt`.

### Root Cause Analysis (Hypotheses)
1.  **InstancedBufferAttribute Conflict**: `InstancedMesh` handles color via a specialized attribute. If `vertexColors: true` is on the material, the material's `color` property acts as a multiplier. If the material color isn't pure white (`0xffffff`), the instance colors will be darkened or negated.
2.  **Svelte 5 Proxy interference**: Svelte 5's `$state` uses proxies. If a proxy color object is passed to Three.js's `setColorAt`, it may fail to parse correctly within the WebGL buffer update.
3.  **Buffer Update Frequency**: The `instanceColor.needsUpdate = true` flag might be being set too frequently or not at all within certain reactive branches.
4.  **Shadow/Fog Interference**: The complex fog logic in the background might be washing out the high-intensity colors of foreground objects.

### Potential Fixes to Investigate
- Force material color to pure white in all observer-active frames.
- Use raw hex values or RGB components for buffer updates instead of Three.js `Color` objects to bypass proxy issues.
- Check if `frustumCulled` or `transparent` settings on the `InstancedMesh` are affecting how vertex colors are blended.
