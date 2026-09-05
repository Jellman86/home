import { Painter, FINE, GRID } from './creature';

/**
 * The Auspex daemon as the app now draws it: a block cursor with eyes,
 * ported from `MascotLook` in `AuspexMascot.swift` for the one state the
 * site can show — idle, content, watching its own output.
 *
 * The app's grammar carries over whole. It is a process, not a creature:
 * violet at every state, blinking on a metronome a shade too regular to be
 * alive, and every so often showing what it is made of. Its tells share a
 * single clock, spaced around it so it only ever does one thing at a time:
 *
 *     0   dump — the interior becomes hex, a memory map, or static
 *     ½   type — it writes a line along its baseline and scrolls it away
 *     ¾   step — it advances a column as if a key went down, and backspaces
 *
 * Every fourth dump slot is the eclipse instead, every third type slot a
 * stare, every fifth step slot a grin: rare enough that most visits never
 * see one. The clock runs from when the mascot appeared, so the first dump
 * lands while someone is still looking and everything after is minutes
 * apart. Reduce Motion stills all of it. Nothing here reads the pointer.
 */

export interface CursorOptions {
    /** The page behind it is dark. The ramp lifts so the block is not a
     *  silhouette of nothing; the hue never changes. */
    isDark: boolean;
    reduceMotion: boolean;
    /** Which dump a visit meets first. Seeded per appearance in the app. */
    variantSeed: number;
}

const rgb = (r: number, g: number, b: number) =>
    `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;

const BODY_DARK = [rgb(0.24, 0.12, 0.40), rgb(0.35, 0.17, 0.56), rgb(0.47, 0.24, 0.72), rgb(0.60, 0.35, 0.88)];
const BODY_LIGHT = [rgb(0.10, 0.03, 0.19), rgb(0.18, 0.05, 0.32), rgb(0.27, 0.08, 0.45), rgb(0.37, 0.13, 0.59)];
const LIFT_DARK = rgb(0.76, 0.58, 0.98);
const LIFT_LIGHT = rgb(0.58, 0.40, 0.86);
const SILHOUETTE_DARK = rgb(0.13, 0.09, 0.20);
const SILHOUETTE_LIGHT = rgb(0.09, 0.05, 0.15);
const ACCENT = rgb(0.72, 0.58, 1.0);
const SCLERA = rgb(0.93, 0.91, 0.96);
const INK = rgb(0.04, 0.02, 0.08);
const EYE = rgb(0.78, 0.49, 1.0);
const GLOW = rgb(0.48, 0.18, 0.83);
const BLACK = '#000000';

/** Idle: the light it throws and how fast the halo breathes. */
const REACH = 1.0;
const CHURN = 0.55;
const TELL_PERIOD = 140;
/** The moment a still frame is drawn at: drawn in, eyes open, no tell. */
export const STILL_MOMENT = 2.0;
const FIRST_DUMP = 4.5;
const DUMP_WINDOW = 2.6;
const TYPE_WINDOW = 2.1;
const STEP_WINDOW = 2.2;
const STARE_WINDOW = 3.2;
const GRIN_WINDOW = 1.6;
const ECLIPSE_WINDOW = 3.6;
const ECLIPSE_EVERY = 4;
const STARE_EVERY = 3;
const GRIN_EVERY = 5;

interface Geometry {
    x0: number; y0: number; w: number; h: number;
    eyeInset: number; eyeRow: number; eyeW: number; eyeH: number;
    irisW: number; irisH: number; pupilW: number; pupilH: number;
    /** Multiplier on every offset that is a "step". */
    k: number;
    /** Whether the prompt glyph and the printout have room. */
    furnished: boolean;
}

const DETAILED: Geometry = {
    x0: 28, y0: 15, w: 20, h: 38,
    eyeInset: 3, eyeRow: 9, eyeW: 6, eyeH: 7,
    irisW: 4, irisH: 5, pupilW: 2, pupilH: 3,
    k: 1, furnished: true
};
const COMPACT: Geometry = {
    x0: 21, y0: 10, w: 30, h: 52,
    eyeInset: 5, eyeRow: 12, eyeW: 9, eyeH: 11,
    irisW: 5, irisH: 7, pupilW: 3, pupilH: 3,
    k: 1.5, furnished: false
};

const smoothstep = (x: number) => {
    const c = x < 0 ? 0 : x > 1 ? 1 : x;
    return c * c * (3 - 2 * c);
};
const fract = (v: number) => v - Math.floor(v);
const mod = (a: number, n: number) => ((a % n) + n) % n;

type Expression = 'none' | 'sideEye' | 'stare' | 'grin' | 'eclipse';

/** Where the eyes open during the eclipse, as fractions of the block. */
const SWARM: [number, number, number, boolean][] = [
    [0.30, 0.30, 0.0, true], [0.70, 0.30, 0.3, true],
    [0.50, 0.14, 2.1, false], [0.22, 0.52, 1.4, false], [0.78, 0.50, 0.8, false],
    [0.50, 0.44, 3.3, false], [0.32, 0.66, 2.6, false], [0.70, 0.68, 1.9, false],
    [0.18, 0.82, 0.5, false], [0.52, 0.80, 2.9, false], [0.82, 0.86, 1.1, false],
    [0.42, 0.93, 3.8, false], [0.64, 0.92, 0.2, false], [0.86, 0.16, 1.6, false],
    [0.14, 0.20, 2.3, false]
];

const HEX_GLYPHS = [
    ['###', '#.#', '#.#', '#.#', '###'], ['.#.', '##.', '.#.', '.#.', '###'],
    ['###', '..#', '###', '#..', '###'], ['###', '..#', '###', '..#', '###'],
    ['#.#', '#.#', '###', '..#', '..#'], ['###', '#..', '###', '..#', '###'],
    ['###', '#..', '###', '#.#', '###'], ['###', '..#', '..#', '..#', '..#'],
    ['###', '#.#', '###', '#.#', '###'], ['###', '#.#', '###', '..#', '###'],
    ['.#.', '#.#', '###', '#.#', '#.#'], ['##.', '#.#', '##.', '#.#', '##.'],
    ['###', '#..', '#..', '#..', '###'], ['##.', '#.#', '#.#', '#.#', '##.'],
    ['###', '#..', '##.', '#..', '###'], ['###', '#..', '##.', '#..', '#..']
];

// --- The clock -------------------------------------------------------------

function tellPhase(t: number, quarter: number, window: number): number | null {
    const start = FIRST_DUMP + TELL_PERIOD * quarter;
    if (t < start) return null;
    const phase = mod(t - start, TELL_PERIOD);
    return phase < window ? phase / window : null;
}

function slotCycle(t: number, quarter: number): number | null {
    const start = FIRST_DUMP + TELL_PERIOD * quarter;
    return t < start ? null : Math.floor((t - start) / TELL_PERIOD);
}

const isEclipseCycle = (t: number) => {
    const c = slotCycle(t, 0);
    return c !== null && c % ECLIPSE_EVERY === ECLIPSE_EVERY - 1;
};
const isStareCycle = (t: number) => {
    const c = slotCycle(t, 0.5);
    return c !== null && c % STARE_EVERY === STARE_EVERY - 1;
};
const isGrinCycle = (t: number) => {
    const c = slotCycle(t, 0.75);
    return c !== null && c % GRIN_EVERY === GRIN_EVERY - 1;
};

function eclipsePhase(t: number, o: CursorOptions): number | null {
    if (o.reduceMotion || !isEclipseCycle(t)) return null;
    return tellPhase(t, 0, ECLIPSE_WINDOW);
}

/** The light goes out of the room. Snaps in; snaps out. */
function eclipse(t: number, o: CursorOptions): number {
    const u = eclipsePhase(t, o);
    if (u === null) return 0;
    if (u < 0.05) return smoothstep(u / 0.05);
    if (u < 0.95) return 1;
    return 1 - smoothstep((u - 0.95) / 0.05);
}

/** Eyes wide, pupils to a point, no blink, halo out. Held, then gone. */
function stare(t: number, o: CursorOptions): number {
    if (o.reduceMotion || !isStareCycle(t)) return 0;
    const u = tellPhase(t, 0.5, STARE_WINDOW);
    if (u === null) return 0;
    if (u < 0.06) return smoothstep(u / 0.06);
    if (u < 0.94) return 1;
    return 1 - smoothstep((u - 0.94) / 0.06);
}

/** Snaps on, holds briefly, snaps off: the point is to doubt you saw it. */
function grin(t: number, o: CursorOptions): number {
    if (o.reduceMotion || !isGrinCycle(t)) return 0;
    const u = tellPhase(t, 0.75, GRIN_WINDOW);
    if (u === null) return 0;
    if (u < 0.05) return smoothstep(u / 0.05);
    if (u < 0.92) return 1;
    return 1 - smoothstep((u - 0.92) / 0.08);
}

function dumpPhase(t: number, o: CursorOptions): number | null {
    if (o.reduceMotion || isEclipseCycle(t)) return null;
    return tellPhase(t, 0, DUMP_WINDOW);
}

/** How much of the block is characters: rises fast, holds, reassembles. */
function dump(t: number, o: CursorOptions): number {
    const u = dumpPhase(t, o);
    if (u === null) return 0;
    if (u < 0.18) return smoothstep(u / 0.18);
    if (u < 0.76) return 1;
    return 1 - smoothstep((u - 0.76) / 0.24);
}

function typing(t: number, o: CursorOptions): number {
    if (o.reduceMotion || isStareCycle(t)) return 0;
    return tellPhase(t, 0.5, TYPE_WINDOW) ?? 0;
}

/** Snaps across, sits, and snaps back — a cursor does not ease. */
function step(t: number, o: CursorOptions): number {
    if (o.reduceMotion || isGrinCycle(t)) return 0;
    const u = tellPhase(t, 0.75, STEP_WINDOW);
    if (u === null) return 0;
    if (u < 0.08) return smoothstep(u / 0.08);
    if (u < 0.70) return 1;
    return 1 - smoothstep((u - 0.70) / 0.12);
}

/** A glance sideways with the top lid down, rarely, when nothing else is
 *  happening. Contempt, briefly. */
function sideEye(t: number, o: CursorOptions): boolean {
    if (o.reduceMotion) return false;
    if (mod(t + 13, 37) >= 1.2) return false;
    return dumpPhase(t, o) === null && typing(t, o) === 0 && step(t, o) === 0 && eclipsePhase(t, o) === null;
}

function expression(t: number, o: CursorOptions): Expression {
    if (o.reduceMotion) return 'none';
    if (eclipse(t, o) > 0.5) return 'eclipse';
    if (stare(t, o) > 0.5) return 'stare';
    if (grin(t, o) > 0.5) return 'grin';
    if (sideEye(t, o)) return 'sideEye';
    return 'none';
}

/** On a metronome, deliberately: a cursor blinks on a clock. */
function cursorBlink(t: number, o: CursorOptions): boolean {
    if (o.reduceMotion || stare(t, o) >= 0.5 || grin(t, o) >= 0.5 || eclipse(t, o) >= 0.5) return false;
    return mod(t + 1.0, 3.4) < 0.14;
}

/** At rest it looks down and left, at its own output. Every few seconds it
 *  glances at the viewer, and now and then somewhere else entirely. */
function gaze(t: number, o: CursorOptions): [number, number] {
    if (o.reduceMotion) return [0, 0];
    if (stare(t, o) > 0.5 || grin(t, o) > 0.5) return [0, 0];
    if (sideEye(t, o)) return [2, 0];
    if (mod(t, 7.3) < 1.3) return [0, 0];
    if (mod(t, 11.7) < 0.9) return [1, -1];
    return [-1, 1];
}

/** It draws itself in from the top, like a terminal painting a character. */
function emergence(t: number, o: CursorOptions): number {
    if (o.reduceMotion) return 1;
    return Math.pow(smoothstep(t / 1.4), 1.3);
}

function dumpVariant(t: number, o: CursorOptions): number {
    const cycle = t > FIRST_DUMP ? Math.floor((t - FIRST_DUMP) / TELL_PERIOD) : 0;
    return mod(o.variantSeed + cycle, 3);
}

/**
 * What it is doing right now, for anything that wants to follow it. The
 * room behind the panel runs on the same clock from the same moment, so
 * when the cursor dumps itself the room dumps with it.
 */
export function tells(t: number, o: CursorOptions) {
    return {
        dump: dump(t, o),
        dumpVariant: dumpVariant(t, o),
        eclipse: eclipse(t, o),
        eclipsePhase: eclipsePhase(t, o),
        stare: stare(t, o),
        typing: typing(t, o),
        step: step(t, o),
        blink: cursorBlink(t, o)
    };
}

export { HEX_GLYPHS, ACCENT, EYE, INK, SCLERA, BODY_DARK, BODY_LIGHT };

// --- Drawing ---------------------------------------------------------------

export function drawCursor(p: Painter, t: number, detailed: boolean, o: CursorOptions): void {
    const body = o.isDark ? BODY_DARK : BODY_LIGHT;
    const lift = o.isDark ? LIFT_DARK : LIFT_LIGHT;
    const silhouette = o.isDark ? SILHOUETTE_DARK : SILHOUETTE_LIGHT;
    const base = detailed ? DETAILED : COMPACT;
    const stepAcross = step(t, o) * 6 * base.k;
    const g: Geometry = { ...base, x0: base.x0 + stepAcross };
    const cx = g.x0 + g.w / 2, cy = g.y0 + g.h / 2, baseline = g.y0 + g.h - 1;

    const dark = eclipse(t, o);
    if (dark > 0.02) darkness(p, cx, cy, dark);
    halo(p, g, cx, cy, t, o);
    if (g.furnished) {
        promptGlyph(p, cy, t, o, body);
        printout(p, g, baseline, t, o, body);
    }
    afterimage(p, g, stepAcross, o, body);
    block(p, g, baseline, t, o, body, lift, silhouette);
}

/** A pool of the state's light behind the block, breathing with churn. It
 *  goes out while it stares, and during the eclipse. */
function halo(p: Painter, g: Geometry, cx: number, cy: number, t: number, o: CursorOptions) {
    const lit = 1 - Math.max(stare(t, o), eclipse(t, o));
    if (lit <= 0.02) return;
    const breath = (o.reduceMotion ? 1 : 0.86 + 0.14 * Math.sin(t * (0.6 + CHURN * 0.9))) * lit;
    const outer = (16 + 12 * REACH) * g.k;
    for (let radius = outer; radius > 10 * g.k; radius -= 1) {
        const falloff = (outer - radius) / (outer - 10 * g.k);
        p.stamp(cx, cy, radius, GLOW, (0.04 + falloff * 0.13) * breath);
    }
}

/** Black over everything, fading only at the far edge of the canvas, so it
 *  reads as the light dying rather than as a square being drawn. */
function darkness(p: Painter, cx: number, cy: number, amount: number) {
    const reach = GRID * 0.62;
    for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
            const d = Math.hypot(x - cx, y - cy);
            const falloff = Math.min(1, Math.max(0, 1 - (d - reach * 0.55) / (reach * 0.45)));
            p.plot(x, y, BLACK, amount * Math.pow(falloff, 0.7));
        }
    }
}

/** The prompt it sits after: a ❯, two strokes two cells thick. */
function promptGlyph(p: Painter, cy: number, t: number, o: CursorOptions, body: string[]) {
    const colour = eclipse(t, o) > 0.5 ? body[1] : ACCENT;
    const x = 12;
    for (let i = 0; i <= 7; i++) {
        for (let thick = 0; thick <= 1; thick++) {
            p.plot(x + i, cy - 8 + i + thick, colour);
            p.plot(x + i, cy + 8 - i - thick, colour);
        }
    }
}

/** The type tell: a line written along the baseline towards the cursor,
 *  then scrolled up and faded. Nobody can read it, which is the point. */
function printout(p: Painter, g: Geometry, baseline: number, t: number, o: CursorOptions, body: string[]) {
    const typed = typing(t, o);
    if (typed <= 0) return;
    const margin = 8;
    const end = g.x0 - 3;
    const written = Math.min(1, typed / 0.62);
    const scrolled = Math.max(0, (typed - 0.7) / 0.3);
    const y = Math.round(baseline - 1 - scrolled * 7);
    const alpha = 1 - scrolled * 0.7;
    const limit = Math.min(end, margin + (end - margin) * written);
    let x = margin;
    let n = dumpVariant(t, o) + 5;
    while (x < limit) {
        n = (Math.imul(n, 1103515245) + 12345) & 0x7fffffff;
        const width = 2 + (n % 4);
        for (let k = 0; k < width; k++) {
            if (x + k >= limit) break;
            p.plot(x + k, y, body[3], alpha);
            p.plot(x + k, y + 1, body[3], alpha);
        }
        x += width + 2;
    }
}

/** Phosphor persistence: ghosts of the block where it was a moment ago,
 *  only while it is moving. A resting cursor leaves no trail. */
function afterimage(p: Painter, g: Geometry, travel: number, o: CursorOptions, body: string[]) {
    if (o.reduceMotion || travel <= 0.5) return;
    for (const [dx, alpha] of [[-travel * 0.5, 0.28], [-travel, 0.14]]) {
        for (let row = 1; row < g.h - 1; row++) {
            for (let col = 0; col < g.w; col++) {
                p.plot(g.x0 + col + dx, g.y0 + row, body[2], 0.35 + alpha);
            }
        }
    }
}

/** The block itself: fill, scanlines, lit edge, and whatever its face is
 *  doing — eyes, a dump, or the eclipse. */
function block(
    p: Painter, g: Geometry, baseline: number, t: number, o: CursorOptions,
    body: string[], lift: string, silhouette: string
) {
    const visible = g.h;
    const top = baseline - visible + 1;
    const drawnRows = Math.round(visible * emergence(t, o));
    const expr = expression(t, o);
    const eclipsed = expr === 'eclipse';
    const dumped = dump(t, o);
    const dumpRows = Math.round(visible * Math.min(1, dumped * 1.25));

    for (let r = 0; r < drawnRows; r++) {
        const y = top + r;
        const edgeRow = r === 0 || r === visible - 1;
        const dumpedRow = r < dumpRows;
        for (let col = 0; col < g.w; col++) {
            const x = g.x0 + col;
            const edgeCol = col === 0 || col === g.w - 1;
            // Rounded: the four corner cells are skipped.
            if (edgeRow && edgeCol) continue;
            if (edgeRow || edgeCol) {
                // Lit along the top and the left; dark along the rest.
                const lit = (r === 0 && col < g.w - 1) || (col === 0 && r > 0);
                p.plot(x, y, eclipsed ? (lit ? body[1] : BLACK) : (lit ? lift : body[0]));
                continue;
            }
            if (eclipsed) { p.plot(x, y, silhouette); continue; }
            if (dumpedRow) { p.plot(x, y, body[0]); continue; }
            p.plot(x, y, r % 3 === 2 ? body[2] : body[3]);
        }
    }

    if (dumpRows > 0) characters(p, g, top, dumpRows, t, o, body);

    const eyeTop = top + g.eyeRow;
    const u = eclipsePhase(t, o);
    if (eclipsed && u !== null) {
        swarmEyes(p, g, top, visible, t, u);
    } else if (dumpRows < g.eyeRow + g.eyeH && drawnRows > g.eyeRow + g.eyeH) {
        eyes(p, g, eyeTop, t, o, expr);
        if (expr === 'grin') mouth(p, g, top, visible);
    }
}

/** Pale sclera, violet iris, dark pupil. The iris moves within the sclera
 *  with the gaze, and shuts to a bar on the blink. */
function eyes(p: Painter, g: Geometry, top: number, t: number, o: CursorOptions, expr: Expression) {
    const big = expr === 'stare';
    const eyeW = g.eyeW + (big ? 2 : 0), eyeH = g.eyeH + (big ? 2 : 0);
    const irisW = g.irisW + (big ? 2 : 0), irisH = g.irisH + (big ? 2 : 0);
    const [lookX, lookY] = gaze(t, o);
    const shut = cursorBlink(t, o);
    let lidTop = 0, lidBottom = 0;
    if (expr === 'grin') { lidTop = Math.floor(eyeH / 2) - 1; lidBottom = Math.floor(eyeH / 2) - 1; }
    if (expr === 'sideEye') { lidTop = Math.floor(eyeH / 2) - 1; lidBottom = 0; }
    // Pinpoint pupils are the stare: the pupil that should be there is not.
    const pupilW = expr === 'stare' ? 1 : g.pupilW;
    const pupilH = expr === 'stare' ? 1 : g.pupilH;
    const inside = (row: number) => row >= lidTop && row < eyeH - lidBottom;

    for (const side of [g.x0 + g.eyeInset - (big ? 1 : 0), g.x0 + g.w - g.eyeInset - g.eyeW - (big ? 1 : 0)]) {
        for (let row = 0; row < eyeH; row++) {
            const y = top + row;
            if (shut) {
                if (row !== Math.floor(eyeH / 2)) continue;
                for (let col = 0; col < eyeW; col++) p.plot(side + col, y, SCLERA);
                continue;
            }
            if (!inside(row)) continue;
            for (let col = 0; col < eyeW; col++) p.plot(side + col, y, SCLERA);
        }
        if (shut) continue;
        const ix = side + Math.floor((eyeW - irisW) / 2) + lookX;
        const iy = top + Math.floor((eyeH - irisH) / 2) + lookY;
        for (let row = 0; row < irisH; row++) {
            const y = iy + row;
            if (!inside(y - top)) continue;
            for (let col = 0; col < irisW; col++) {
                const x = ix + col;
                if (x < side || x >= side + eyeW) continue;
                p.plot(x, y, EYE);
            }
        }
        const px = ix + Math.floor((irisW - pupilW) / 2);
        const py = iy + Math.floor((irisH - pupilH) / 2);
        for (let row = 0; row < pupilH; row++) {
            const y = py + row;
            if (!inside(y - top)) continue;
            for (let col = 0; col < pupilW; col++) {
                const x = px + col;
                if (x < side || x >= side + eyeW) continue;
                p.plot(x, y, INK);
            }
        }
    }
}

/** The grin. A cursor has no mouth, which is why this one is wrong. */
function mouth(p: Painter, g: Geometry, top: number, visible: number) {
    const row = Math.round(visible * 0.72);
    if (row + 2 >= visible) return;
    const y = top + row;
    const inset = 3 * g.k;
    const width = g.w - inset * 2;
    for (let r = 0; r < Math.floor(2 * g.k); r++) {
        for (let col = 0; col < width; col++) {
            const gap = Math.floor(col / Math.max(1, Math.floor(g.k))) % 3 === 2;
            p.plot(g.x0 + inset + col, y + r, gap ? INK : SCLERA);
        }
    }
    for (let col = 0; col < width; col++) p.plot(g.x0 + inset + col, y - 1, INK);
}

/** Eyes all over the silhouette, opening one after another and shutting
 *  together: one eye per cell it would need, and it has been showing you two. */
function swarmEyes(p: Painter, g: Geometry, top: number, visible: number, t: number, u: number) {
    SWARM.forEach(([sx, sy, phase, wide], index) => {
        const opens = 0.05 + index * 0.032;
        if (u < opens || u >= 0.93) return;
        if (mod(t * 1.3 + phase, 2.7) < 0.12) return;
        const w = (wide ? 4 : 3) * g.k;
        const h = Math.max(1, Math.round((wide ? 2 : 1) * g.k));
        const cx = g.x0 + g.w * sx;
        const row = Math.round(visible * sy);
        if (row + h >= visible - 1) return;
        const x0 = Math.round(cx - w / 2);
        const y0 = top + row;
        p.stamp(cx, y0 + h / 2, w * 0.8, EYE, 0.22);
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const pupil = c === Math.floor(w / 2) && (h < 2 || r === Math.floor(h / 2));
                p.plot(x0 + c, y0 + r, pupil ? INK : EYE);
            }
        }
    });
}

/** The dump: the interior as raw characters, on the fine grid. The one
 *  element drawn at a resolution the block does not have. */
function characters(p: Painter, g: Geometry, top: number, rows: number, t: number, o: CursorOptions, body: string[]) {
    const f = FINE;
    const x0 = (g.x0 + 2) * f, x1 = (g.x0 + g.w - 2) * f;
    const y0 = (top + 2) * f, y1 = (top + rows - 1) * f;
    if (y1 <= y0) return;
    const tick = Math.floor(t * 5);
    const variant = dumpVariant(t, o);

    if (variant === 1) {
        // Memory map: one bar per line, width from a hash.
        let n = 0;
        for (let y = y0; y < y1; y += (3 * f) / 2, n++) {
            const fraction = fract(Math.sin(n * 7.13 + tick * 0.37 + o.variantSeed) * 43758.5453);
            const width = (x1 - x0) * (0.2 + fraction * 0.8);
            for (let x = x0; x < x0 + width; x++) {
                for (let dy = 0; dy < f; dy++) p.plotFine(x, y + dy, fraction > 0.7 ? EYE : body[3], 0.9);
            }
        }
    } else if (variant === 2) {
        // Static, at a pixel-art rate rather than boiling every frame.
        for (let y = y0; y < y1; y += 2) {
            for (let x = x0; x < x1; x += 2) {
                const value = fract(Math.sin(x * 127.1 + y * 311.7 + tick * 74.7) * 43758.545);
                const colour = value < 0.58 ? null : value < 0.80 ? body[2] : value < 0.94 ? body[3] : SCLERA;
                if (!colour) continue;
                for (let dy = 0; dy < 2; dy++)
                    for (let dx = 0; dx < 2; dx++) p.plotFine(x + dx, y + dy, colour, 0.85);
            }
        }
    } else {
        // Hex: real digits, 3×5 glyphs at twice the fine cell, in columns.
        const glyphW = 6, glyphH = 10, pitchX = glyphW + 2, pitchY = glyphH + 2;
        let row = 0;
        for (let y = y0; y + glyphH <= y1; y += pitchY, row++) {
            let col = 0;
            for (let x = x0; x + glyphW <= x1; x += pitchX, col++) {
                const digit = Math.floor(fract(Math.sin(row * 12.9898 + col * 78.233 + o.variantSeed + tick * 0.11) * 43758.5453) * 16) & 15;
                const bright = (row + col) % 5 === tick % 5;
                const colour = bright ? EYE : body[3];
                HEX_GLYPHS[digit].forEach((line, gy) => {
                    for (let gx = 0; gx < line.length; gx++) {
                        if (line[gx] !== '#') continue;
                        for (let dy = 0; dy < 2; dy++)
                            for (let dx = 0; dx < 2; dx++) p.plotFine(x + gx * 2 + dx, y + gy * 2 + dy, colour, 0.95);
                    }
                });
            }
        }
    }
}
