/** Pure layout and clock policy, shared by the renderer and regression checks. */
export const STEP = 1 / 60;
export const MAX_STEPS = 4;

export function advanceClock(accumulator: number, elapsed: number, active: boolean) {
    if (!active || elapsed > 0.25) return { steps: 0, remainder: 0 };
    const total = accumulator + Math.min(STEP * MAX_STEPS, Math.max(0, elapsed));
    const steps = Math.min(MAX_STEPS, Math.floor((total + 1e-9) / STEP));
    return { steps, remainder: Math.max(0, total - steps * STEP) };
}

export function galaxyLayout(width: number, height: number) {
    const aspect = width / height;
    if (width < 800) {
        // Fixed mobile sky, independent of card size, dragging and scrolling.
        return { x: 0.06 * aspect, y: 1 - 270 / height, scale: width * 0.86 / height };
    }
    return { x: aspect * 0.28, y: 0.62, scale: Math.min(0.98, aspect * 0.82) };
}

export type EncounterKind = 'ship' | 'black-hole';
export interface Encounter { kind: EncounterKind; age: number; duration: number; lane: number; reverse: boolean }

/** One encounter at a time, with quiet intervals measured in visible sky time. */
export function createEncounterDirector(random: () => number = Math.random) {
    let wait = 45 + random() * 65;
    let current: Encounter | null = null;
    return {
        update(elapsed: number, enabled: boolean): Encounter | null {
            if (!enabled) return null;
            const dt = elapsed > 0.25 ? 0 : Math.max(0, elapsed);
            if (current) {
                current.age += dt;
                if (current.age >= current.duration) {
                    current = null;
                    wait = 120 + random() * 150;
                }
            } else {
                wait -= dt;
                if (wait <= 0) {
                    const kind = random() < 0.55 ? 'ship' : 'black-hole';
                    current = { kind, age: 0, duration: kind === 'ship' ? 18 : 72, lane: random(), reverse: random() < 0.5 };
                }
            }
            return current;
        },
        status() { return { kind: current?.kind ?? null, age: current?.age ?? 0, nextIn: current ? null : Math.ceil(wait) }; }
    };
}

/** Fixed CSS-pixel paths through the upper sky, independent of panel position. */
export function encounterPose(event: Encounter, width: number, height: number) {
    const progress = Math.min(1, Math.max(0, event.age / event.duration));
    const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
    const opacity = smooth(progress / 0.15) * smooth((1 - progress) / 0.2);
    if (event.kind === 'black-hole') {
        // Arrive from the empty left margin, not on the galactic core. The
        // phone path starts low-left, outside its wider, fixed disc.
        const mobile = width < 800;
        const x = width * (0.045 + progress * (mobile ? 0.22 : 0.25));
        const y = mobile ? 240 - progress * 75 : height * (0.075 + event.lane * 0.025) + progress * 28;
        const approach = smooth(progress);
        return { x: x / width, y: 1 - y / height, angle: 0, opacity,
            size: 4 + approach * 2, reach: 48 + approach * 24 };
    }
    const skyHeight = Math.max(90, Math.min(height * 0.45, 270));
    const direction = event.reverse ? -1 : 1;
    const travel = event.reverse ? 1 - progress : progress;
    const x = width * (0.10 + travel * 0.80);
    const y = skyHeight * (0.28 + event.lane * 0.26) + Math.sin(progress * Math.PI) * 14;
    const angle = Math.atan2(-Math.cos(progress * Math.PI) * 14 * Math.PI, direction * width * 0.8);
    return { x: x / width, y: 1 - y / height, angle, opacity, size: 10, reach: 80 };
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
