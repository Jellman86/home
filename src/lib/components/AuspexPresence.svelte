<script lang="ts">
    import {
        BODY, EYE, FINE, lattice, lens, inkMass, paleMass, strayEye, smoothstep
    } from '$lib/auspex/creature';

    /**
     * What arrives behind the panel while the Auspex tile is hovered.
     *
     * A 2D canvas laid over the WebGL scene rather than geometry inside it. The
     * creature is flat, enormous and drawn in quantised blocks; putting it in
     * the Three.js scene would buy perspective it must not have — a silhouette
     * you can complete is a mascot, and this must never resolve into one.
     *
     * The rules it follows, in order of how much they matter:
     *
     * - **It must not resolve.** One curved edge crosses the frame and no other.
     * - **It must not look at the cursor.** Nothing here reads pointer position.
     * - **Only what the mask covered may be sharp.** Everything is drawn on a
     *   coarse lattice except the lens, which uses a cell a quarter the size.
     * - **It goes when you go.** Slower out than in, but leaving the tile
     *   dismisses it rather than starting a queue.
     * - **The panel stays readable.** Being tolerated is worse than being
     *   obstructed.
     */
    let { active = false, variant = 'dark' }: { active?: boolean; variant?: 'light' | 'dark' } = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let reduceMotion = false;
    let frameId = 0;
    let lastFrame = 0;

    /**
     * The prop, mirrored into a plain variable.
     *
     * `step` and `draw` run from requestAnimationFrame rather than from
     * anything reactive, and this loop is the one place on the page where
     * reading a stale value would leave the canvas painted forever with
     * nothing running to clear it. Syncing it in an effect removes the question
     * entirely rather than relying on how a destructured prop behaves inside a
     * callback.
     */
    let wantsPresence = false;

    /** How far in it is. */
    let value = 0;
    /** Runs ahead of `value`: the flock is told to scatter before the tile has
     *  finished registering the hover, which is the only moment on the site
     *  where something anticipates the user. */
    let lead = 0;
    /** Seconds held at full presence. Drives the reveal. */
    let held = 0;

    // Fixed positions, aimed at nothing. Perimeter-ish so they frame the panel
    // without ringing it — a ring reads as staging, and staging reads as intent.
    const STRAY: [number, number, number, number][] = [
        [0.95, 0.16, 1.7, 1.0], [0.06, 0.82, 2.2, 0.75], [0.90, 0.72, 3.1, 0.6]
    ];

    // Limbs at different distances: near ones large and dark, far ones small.
    // None of them share an origin you can see, which is what stops the eye
    // assembling a body out of them.
    const LIMBS: [number, number, number, number][] = [
        [-0.14, 1.22, -1.06, 1.00],
        [1.12, 1.18, -2.02, 0.85],
        [0.58, 1.34, -1.52, 0.5]
    ];

    function step(dt: number) {
        const on = wantsPresence;
        if (reduceMotion) {
            value = on ? 1 : 0;
            lead = value;
            held = 0;
            return;
        }
        lead += (on ? 1 - lead : -lead) * (on ? 0.16 : 0.05) * dt;

        // Leaving the tile dismisses it. An earlier version let the reveal play
        // out whatever the cursor did, on the theory that something which
        // ignores you is worse than something that obeys — but a background
        // still winding down five seconds after you moved on reads as stuck,
        // not as ominous. Still slower out than in, just not stubborn.
        const wants = on ? 1 : 0;
        // Out faster on the light theme. The same fade that is unobtrusive
        // behind a navy page is a room that stays dark for two seconds behind a
        // white one, and that reads as broken rather than as atmosphere.
        const out = variant === 'light' ? 0.11 : 0.045;
        value += (wants - value) * (wants > value ? 0.05 : out) * dt;
        held = wants && value > 0.9 ? held + dt / 30 : Math.max(0, held - dt / 8);
    }

    function draw(now: number) {
        // Idle costs nothing: with the tile unhovered and the fade finished
        // there is no frame to ask for, so the page is not running a canvas
        // loop for the ninety-nine percent of a visit that nobody hovers it.
        if (!wantsPresence && value <= 0.004) {
            frameId = 0;
            if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        frameId = requestAnimationFrame(draw);
        if (!canvas) return;
        // 30fps: it is a grid of large blocks, and nothing here rewards more.
        if (now - lastFrame < 33) return;
        const dt = Math.min(3, (now - lastFrame) / 33.3);
        lastFrame = now;
        step(dt);

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

        const t = now * 0.001;
        const rev = reduceMotion ? 0 : held > 0.9 ? smoothstep((held - 0.9) / 1.5) : 0;

        // The scrim goes first, so the pale that follows sits on the near-black
        // ground it was drawn for rather than reading as fog over the navy.
        //
        // On the dark theme it stays light on purpose: the galaxy has gone out
        // to make room for this, and what is left behind the canvas is the
        // page's own ground, which a heavy wash would only turn to mud.
        //
        // Blueprint light needs the opposite. White stars on a blue-50 page are
        // invisible however bright they are, so there the scrim goes most of the
        // way to black and the arrival is the lights going out — which is a
        // better beat than the dark theme gets, and costs one number.
        ctx.fillStyle = `rgba(4,2,10,${k * (variant === 'light' ? 0.88 : 0.26)})`;
        ctx.fillRect(0, 0, w, h);

        // The pale. It slides away as the mask comes off, uncovering what the
        // painted eye was standing in for.
        // Placed so its one visible edge falls in the margin beside the About Me
        // panel rather than behind it. The panel is opaque and takes the middle
        // thousand pixels of a desktop window, so anything centred here is a
        // thing nobody ever sees.
        const cell = Math.max(15, h * 0.068);
        const mcx = w * 1.42 + rev * w * 0.7, mcy = h * 1.15, mrx = w * 0.85, mry = h * 1.5;
        const eyeY = mcy - mry * 0.385;
        paleMass(ctx, mcx, mcy, mrx, mry, cell, w, h, k * 0.085);
        inkMass(ctx, mcx - mrx * 0.5, eyeY, cell * 2.2, cell, w, h, k * 0.92);
        inkMass(ctx, mcx + mrx * 0.5, eyeY, cell * 2.2, cell, w, h, k * 0.92);

        // Limbs entering frame and leaving it. Three, not a thicket: the moment
        // there are enough of them to fill the frame they stop reading as limbs
        // and start reading as pipework.
        if (k > 0.03) {
            const stride = 6;
            LIMBS.forEach((d, i) => {
                let theta = d[2] + Math.sin(t * 0.17 + i) * 0.05;
                let x = w * d[0], y = h * d[1];
                const length = h * 1.5 * smoothstep((k - 0.03) / 0.55) * (0.84 + 0.16 * Math.sin(t * 0.24 + i * 1.7));
                const near = d[3];
                // One cell size for the whole limb. Recomputing it per step
                // re-aligned the lattice every step and turned each limb into a
                // string of beads.
                const size = Math.max(7, h * 0.026) * Math.max(0.6, near);
                // Taper is a cell count, not a cell size, so the limb narrows
                // without the blocks changing scale down its length.
                const baseCells = near > 0.9 ? 2 : 1;
                for (let arc = 0; arc < length; arc += stride) {
                    const progress = arc / length;
                    // The same curvature wave the app's limbs use: a bend that
                    // travels from base to tip rather than a wobble applied to
                    // the whole ray, which is what stops it looking mechanical.
                    theta += 0.05 * Math.pow(progress, 1.25) * Math.sin(t * 0.66 - arc * 0.016 + i * 2.1);
                    x += Math.cos(theta) * stride;
                    y += Math.sin(theta) * stride;
                    if (x < -160 || x > w + 160 || y < -160 || y > h + 160) continue;
                    const half = Math.round(baseCells * Math.pow(1 - progress, 0.6));
                    const nx = Math.cos(theta + Math.PI / 2), ny = Math.sin(theta + Math.PI / 2);
                    for (let c = -half; c <= half; c++) {
                        const gx = lattice(x + nx * c * size, size);
                        const gy = lattice(y + ny * c * size, size);
                        // The rim cell on the lit side stays bright, so the limb
                        // has a wet edge instead of a flat silhouette.
                        const rim = c === -half && half > 0;
                        ctx.globalAlpha = (rim ? 0.5 : 0.72) + 0.28 * near;
                        ctx.fillStyle = rim ? BODY[3] : BODY[Math.max(0, 2 - Math.min(2, (progress * 3) | 0))];
                        ctx.fillRect(gx, gy, size + 0.6, size + 0.6);
                    }
                }
            });
            ctx.globalAlpha = 1;
        }

        if (k > 0.14) {
            const a = smoothstep((k - 0.14) / 0.5) * 0.9;
            const ec = Math.max(3, h * 0.013);
            for (const e of STRAY) strayEye(ctx, e[0] * w, e[1] * h, ec * e[3], a, e[2], t);
        }

        if (rev > 0.01) {
            // Hard against the left edge and cropped by it: partly because the
            // panel owns the middle, and partly because a thing you cannot fit
            // in frame is the entire point.
            lens(ctx, w * 0.035, h * 0.5, h * 0.36 * rev, h * 0.13 * rev,
                 cell / FINE, Math.min(1, rev * 1.25), t, w, h);
        }

        // The frame closes in a little. Not a mood filter — it is the only cue
        // that the scene has depth now that the flock is a sky.
        const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.32, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, `rgba(3,1,8,${k * 0.30})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * Restarts the loop after it has parked itself.
     *
     * This deliberately has no cleanup. An earlier version cancelled the frame
     * in the effect's teardown, which runs on every re-run and not only on
     * destroy — so un-hovering killed the loop while `value` was still at one
     * and the canvas froze at full presence with nothing left running to fade
     * it. The loop decides when to stop, in `draw`; nothing else may.
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

    // Teardown only. No dependencies, so its cleanup runs when the component
    // goes away and at no other time.
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
