/** Pure layout and clock policy, shared by the renderer and regression checks. */
export const STEP = 1 / 60;
export const MAX_STEPS = 4;

export function advanceClock(accumulator: number, elapsed: number, active: boolean) {
    if (!active || elapsed > 0.25) return { steps: 0, remainder: 0 };
    const total = accumulator + Math.min(STEP * MAX_STEPS, Math.max(0, elapsed));
    const steps = Math.min(MAX_STEPS, Math.floor((total + 1e-9) / STEP));
    return { steps, remainder: Math.max(0, total - steps * STEP) };
}

export interface PanelBounds { top: number; right: number; bottom: number; left: number }

export function galaxyLayout(width: number, height: number, panel?: PanelBounds | null) {
    const aspect = width / height;
    if (panel && panel.bottom - panel.top < 100) {
        // Minimising the card opens an unobstructed, full-size viewing mode.
        return { x: 0, y: 0.1, scale: Math.min(0.82, aspect * 0.8) };
    }
    if (width < 800) {
        // A complete small disc in the reserved mobile sky, above the card.
        const skyHeight = Math.max(140, Math.min(220, panel?.top ?? 190));
        return { x: 0.06 * aspect, y: 1 - skyHeight / height, scale: Math.min(width * 0.43, skyHeight * 0.48) * 2 / height };
    }
    // Keep the core in the visible strip above the panel. Clamp dragged cards
    // so a window move cannot send the galaxy flying off the viewport.
    const top = Math.max(140, Math.min(height * 0.7, panel?.top ?? 190));
    return { x: aspect * 0.32, y: 1 - top / height, scale: Math.min(0.6, aspect * 0.63) };
}

/** Reproducible fields make visual regressions and initial conditions comparable. */
export function seededRandom(seed = 0x706f776e) {
    return () => {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
