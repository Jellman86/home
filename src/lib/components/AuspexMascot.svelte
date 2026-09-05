<script lang="ts">
    import { GRID, Painter } from '$lib/auspex/creature';
    import { drawCursor, STILL_MOMENT } from '$lib/auspex/cursor';

    /**
     * The daemon at card size, as the app draws it: a block cursor with eyes
     * after a prompt, blinking on a clock, now and then showing what it is
     * made of. Hovering its tile is what puts it on screen.
     */
    let { size = 160, variant = 'dark' }: { size?: number; variant?: 'light' | 'dark' } = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let frameId = 0;
    let lastFrame = 0;
    let painted = false;
    const painter = new Painter(GRID);
    let reduceMotion = false;
    let startedAt = 0;
    // Seeded per appearance, as in the app: each visit meets a different
    // dump first, and it holds for the whole visit.
    const variantSeed = Math.floor(Math.random() * 3000);

    /**
     * Below this the prompt glyph and the printout are one device pixel each,
     * and the block alone carries the character — the app's own threshold.
     * The link tile asks for sixteen: that is a still frame of the compact
     * form, drawn once, because a 72-cell grid animating at a fifth of a
     * pixel per cell is several thousand fills a frame for nothing anyone
     * can see move.
     */
    const DETAILED_ABOVE = 64;
    let detailed = $derived(size >= DETAILED_ABOVE);
    let animates = $derived(detailed && !reduceMotion);

    function render(t: number) {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const px = Math.round(size * dpr);
        if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        painter.clear();
        drawCursor(painter, t, detailed, { isDark: variant === 'dark', reduceMotion: reduceMotion || !animates, variantSeed });
        painter.paint(ctx, size / GRID, 0, 0);
        painted = true;
    }

    function loop(now: number) {
        if (!animates || document.hidden) { frameId = 0; return; }
        frameId = requestAnimationFrame(loop);
        // Fourteen frames a second, the app's rate for the detailed form.
        if (now - lastFrame < 71) return;
        lastFrame = now;
        render((now - startedAt) * 0.001);
    }

    $effect(() => {
        if (typeof window === 'undefined') return;
        reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        void size; void variant;
        if (!startedAt) startedAt = performance.now();
        if (animates) {
            if (!frameId) { lastFrame = 0; frameId = requestAnimationFrame(loop); }
        } else if (!painted || variant) {
            // A settled moment, not zero: at zero the block has not drawn
            // itself in yet, and a still frame of nothing is an empty tile.
            render(STILL_MOMENT);
        }
    });

    // A hidden tab should not be drawing anything. Resumed on return.
    $effect(() => {
        if (typeof document === 'undefined') return;
        const onVisibility = () => {
            if (document.hidden || !animates) return;
            if (!frameId) { lastFrame = 0; frameId = requestAnimationFrame(loop); }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    });

    // Teardown only: no dependencies, so this cleanup runs when the component
    // goes away and at no other time.
    $effect(() => () => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
    });
</script>

<canvas
    bind:this={canvas}
    style="width:{size}px;height:{size}px"
    class="block"
    aria-hidden="true"
></canvas>
