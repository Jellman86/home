<script lang="ts">
    import { CX, CY, GRID, Painter, drawMask, renderCompact } from '$lib/auspex/creature';

    /**
     * The creature at card size, as the app draws it: the mask, and every so
     * often a limb from behind it. Hovering its tile is what makes it stand up.
     */
    let { size = 160 }: { size?: number } = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let frameId = 0;
    let lastFrame = 0;
    let painted = false;
    const painter = new Painter(GRID);
    let reduceMotion = false;
    let startedAt = 0;

    /**
     * Below this the creature is not merely small but invisible, and drawing it
     * costs the same as drawing it large — the painter emits one fill per
     * occupied cell of a 72-square grid however many pixels those cells land
     * on. The link tile asks for sixteen, which is a cell size of a fifth of a
     * pixel and several thousand sub-pixel fills per frame, forever, on every
     * visit, for something nobody can see moving.
     *
     * So under this size it is drawn once and left alone. The same threshold
     * the app uses to decide whether the detail is worth having.
     */
    const ANIMATES_ABOVE = 64;
    let animates = $derived(size >= ANIMATES_ABOVE && !reduceMotion);

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
        if (size >= ANIMATES_ABOVE) {
            renderCompact(painter, t, !animates);
        } else {
            // The mask alone. The halo and the limbs are what make the compact
            // form read at card size and what make it mud at tile size.
            drawMask(painter, CX, CY + 2, 2.15);
        }
        painter.paint(ctx, size / GRID, 0, 0);
        painted = true;
    }

    function loop(now: number) {
        if (!animates || document.hidden) { frameId = 0; return; }
        frameId = requestAnimationFrame(loop);
        // 12fps. It is a grid of blocks drifting slowly; more frames buy nothing
        // and this runs for as long as the panel is open.
        if (now - lastFrame < 83) return;
        lastFrame = now;
        render((now - startedAt) * 0.001);
    }

    $effect(() => {
        if (typeof window === 'undefined') return;
        reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        void size;
        if (!startedAt) startedAt = performance.now();
        if (animates) {
            if (!frameId) { lastFrame = 0; frameId = requestAnimationFrame(loop); }
        } else if (!painted) {
            render(0);
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
    // goes away and at no other time. Cancelling in an effect that depends on
    // something is how the presence canvas ended up frozen mid-fade.
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
