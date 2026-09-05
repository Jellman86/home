<script lang="ts">
    import { tells, HEX_GLYPHS, ACCENT, EYE, INK, BODY_DARK, BODY_LIGHT } from '$lib/auspex/cursor';

    /**
     * The daemon's window, opened: what arrives behind the panel while the
     * Auspex tile is hovered.
     *
     * The mascot is a process, so the room it lives in is a terminal. The
     * sky goes out, a dim prompt sits in the left margin, and lines of output
     * nobody asked for scroll up across the screen — the same blocky
     * printout the cursor itself types, at room scale. It runs on the
     * mascot's own clock from the same moment, so its tells reach the room:
     * when the cursor dumps itself as hex, a sweep of hex crosses the
     * backdrop with it, and during its eclipse the light goes out entirely
     * and eyes open across the dark.
     *
     * A 2D canvas over the WebGL scene, on a coarse cell lattice like the
     * mascot, at a low frame rate. Nothing here reads the pointer. It goes
     * when you go: slower out than in, but leaving the tile dismisses it.
     */
    let { active = false, variant = 'dark' }: { active?: boolean; variant?: 'light' | 'dark' } = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let reduceMotion = false;
    let frameId = 0;
    let lastFrame = 0;

    /** The prop, mirrored into a plain variable for the frame loop. */
    let wantsPresence = false;
    /** How far in it is. */
    let value = 0;
    /** Seconds since the tile was hovered: the mascot's clock, which starts
     *  when it mounts, at the same moment. */
    let since = 0;
    /** The dump this visit meets first. The mascot seeds its own; the room
     *  seeds its own; they rotate together from then on, which is enough. */
    const variantSeed = Math.floor(Math.random() * 3000);

    interface Line { y: number; words: number[]; alpha: number; born: number }
    let lines: Line[] = [];
    let nextLineAt = 0;
    let rng = 12345;
    const random = () => { rng = (Math.imul(rng, 1103515245) + 12345) & 0x7fffffff; return rng / 0x7fffffff; };

    /** Where the eyes open during the eclipse, as fractions of the screen,
     *  away from the middle the panel owns. */
    const EYES: [number, number, number][] = [
        [0.06, 0.18, 0.0], [0.11, 0.62, 0.9], [0.05, 0.86, 2.1], [0.16, 0.36, 1.4],
        [0.92, 0.12, 0.4], [0.88, 0.48, 1.9], [0.95, 0.74, 2.6], [0.84, 0.92, 0.7],
        [0.30, 0.06, 3.1], [0.68, 0.05, 1.1], [0.44, 0.95, 2.4], [0.60, 0.93, 0.2]
    ];

    function step(dt: number) {
        const on = wantsPresence;
        if (reduceMotion) { value = on ? 1 : 0; return; }
        // Out faster on the light theme, where a room that stays dark for
        // two seconds behind a white page reads as broken.
        const out = variant === 'light' ? 0.11 : 0.045;
        value += ((on ? 1 : 0) - value) * (on && value < 1 ? 0.05 : out) * dt;
    }

    function draw(now: number) {
        if (!wantsPresence && value <= 0.004) {
            frameId = 0;
            since = 0;
            lines = [];
            nextLineAt = 0;
            if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        frameId = requestAnimationFrame(draw);
        if (!canvas) return;
        // Fourteen frames a second, the mascot's rate.
        if (now - lastFrame < 71) return;
        const dtSec = Math.min(0.1, (now - lastFrame) * 0.001);
        const dt = dtSec / (1 / 30);
        lastFrame = now;
        step(dt);
        if (wantsPresence && !reduceMotion) since += dtSec;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const k = value;
        if (k <= 0.004) return;

        const dark = variant === 'dark';
        const body = dark ? BODY_DARK : BODY_LIGHT;
        const t = tells(since, { isDark: dark, reduceMotion, variantSeed });
        // One cell: the lattice everything sits on. Coarse, like the mascot.
        const cell = Math.max(6, Math.round(h / 72));
        const lit = 1 - Math.max(t.stare, t.eclipse);

        // The room. Dark enough that the printout is the brightest thing in
        // it; on the light theme the arrival is the lights going out.
        ctx.fillStyle = `rgba(4,2,10,${k * (dark ? 0.72 : 0.9)})`;
        ctx.fillRect(0, 0, w, h);
        if (t.eclipse > 0) {
            ctx.fillStyle = `rgba(0,0,0,${k * t.eclipse * 0.85})`;
            ctx.fillRect(0, 0, w, h);
        }

        // The prompt, in the left margin: a ❯ two cells thick, in the
        // accent, dimmed while the light is out.
        const px = cell * 3, py = Math.round(h * 0.5);
        ctx.globalAlpha = k * (0.18 + 0.22 * lit);
        ctx.fillStyle = t.eclipse > 0.5 ? body[1] : ACCENT;
        for (let i = 0; i <= 7; i++) {
            for (let thick = 0; thick <= 1; thick++) {
                ctx.fillRect(px + i * cell, py - (8 - i - thick) * cell, cell + 0.6, cell + 0.6);
                ctx.fillRect(px + i * cell, py + (8 - i - thick) * cell - cell, cell + 0.6, cell + 0.6);
            }
        }

        // The printout: lines born at the bottom, rising, fading with age.
        // Under Reduce Motion a few sit still.
        const margin = px + 11 * cell;
        const lineHeight = cell * 3;
        if (reduceMotion && lines.length === 0) {
            for (let i = 0; i < 6; i++) lines.push(newLine(w, cell, margin, h - lineHeight * (2 + i * 1.5), since));
        }
        if (!reduceMotion && wantsPresence && since >= nextLineAt) {
            lines.push(newLine(w, cell, margin, h + lineHeight, since));
            // Faster while it types, as the cursor's own line is being written.
            nextLineAt = since + (t.typing > 0 ? 0.35 : 1.4 + random() * 1.2);
        }
        const rise = reduceMotion ? 0 : lineHeight * 0.55 * dtSec;
        for (const line of lines) {
            line.y -= rise;
            const age = since - line.born;
            line.alpha = Math.min(1, age * 2) * Math.max(0, 1 - age / 26);
        }
        lines = lines.filter((l) => l.y > -lineHeight && l.alpha > 0.01);
        ctx.fillStyle = body[3];
        for (const line of lines) {
            const y = Math.round(line.y / cell) * cell;
            ctx.globalAlpha = k * line.alpha * 0.55 * (0.3 + 0.7 * lit);
            let x = margin;
            for (const width of line.words) {
                ctx.fillRect(x, y, width * cell + 0.6, cell * 2 + 0.6);
                x += (width + 2) * cell;
            }
        }

        // The dump reaches the room: a sweep of hex across the backdrop,
        // revealed with the cursor's own, and gone with it.
        if (t.dump > 0.02) {
            const glyphCell = Math.max(2, Math.round(cell * 0.5));
            const pitchX = glyphCell * 5, pitchY = glyphCell * 8;
            const tick = Math.floor(since * 5);
            const reveal = w * Math.min(1, t.dump * 1.15);
            ctx.globalAlpha = k * 0.42 * t.dump;
            for (let row = 0, y = cell * 2; y + glyphCell * 5 < h; y += pitchY, row++) {
                for (let col = 0, x = cell * 2; x + glyphCell * 3 < reveal; x += pitchX, col++) {
                    const hsh = Math.sin(row * 12.9898 + col * 78.233 + variantSeed + tick * 0.11) * 43758.5453;
                    const digit = Math.floor((hsh - Math.floor(hsh)) * 16) & 15;
                    const bright = (row + col) % 7 === tick % 7;
                    ctx.fillStyle = bright ? EYE : body[3];
                    const shape = HEX_GLYPHS[digit];
                    for (let gy = 0; gy < 5; gy++) {
                        for (let gx = 0; gx < 3; gx++) {
                            if (shape[gy][gx] !== '#') continue;
                            ctx.fillRect(x + gx * glyphCell, y + gy * glyphCell, glyphCell + 0.4, glyphCell + 0.4);
                        }
                    }
                }
            }
        }

        // The eclipse: eyes open across the dark, one after another, and
        // shut together. In the margins, where the panel is not.
        if (t.eclipsePhase !== null) {
            const u = t.eclipsePhase;
            EYES.forEach(([fx, fy, phase], index) => {
                const opens = 0.05 + index * 0.05;
                if (u < opens || u >= 0.93) return;
                if (((since * 1.3 + phase) % 2.7) < 0.12) return;
                const ex = Math.round((w * fx) / cell) * cell, ey = Math.round((h * fy) / cell) * cell;
                const ew = cell * 5, eh = cell * 3;
                ctx.globalAlpha = k * 0.9;
                ctx.fillStyle = EYE;
                ctx.fillRect(ex, ey, ew, eh);
                ctx.fillStyle = INK;
                ctx.fillRect(ex + cell * 2, ey + cell, cell, cell);
            });
        }
        ctx.globalAlpha = 1;
    }

    function newLine(w: number, cell: number, margin: number, y: number, born: number): Line {
        const words: number[] = [];
        const limit = Math.floor(((w - margin) / cell) * (0.25 + random() * 0.7));
        let used = 0;
        while (used < limit) {
            const width = 2 + Math.floor(random() * 4);
            words.push(width);
            used += width + 2;
        }
        return { y, words, alpha: 0, born };
    }

    /**
     * Restarts the loop after it has parked itself. Deliberately no cleanup
     * here: the loop decides when to stop, in `draw`, and nothing else may.
     */
    $effect(() => {
        if (typeof window === 'undefined') return;
        wantsPresence = active;
        reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!frameId) {
            lastFrame = performance.now();
            frameId = requestAnimationFrame(draw);
        }
    });

    // Teardown only.
    $effect(() => () => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
    });
</script>

<canvas
    bind:this={canvas}
    class="pointer-events-none fixed inset-0 z-[6] h-full w-full"
    aria-hidden="true"
></canvas>
