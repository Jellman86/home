# Known Issues & Bug Tracking

## 🟡 [PENDING VERIFICATION] Observer Color Charge Invisibility

### Status Update (BUILD 44677ce)
The boids have been upgraded to `MeshPhongMaterial` with a dynamic lighting system. This change addresses the "black wall" effect and provides a physical light source to illuminate the color shifts. Verification is needed to confirm if the white lerp is now clearly visible.

### Description
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
