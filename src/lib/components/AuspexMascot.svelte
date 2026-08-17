<script lang="ts">
    import { GRID, Painter, renderCompact } from '$lib/auspex/creature';

    /** The creature at card size, as the app draws it: the mask, and every so
     *  often a limb from behind it. Hovering its tile is what makes it stand up. */
    let { size = 160 }: { size?: number } = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let frameId = 0;
    let lastFrame = 0;
    const painter = new Painter(GRID);
    let reduceMotion = false;
    let startedAt = 0;

    function draw(now: number) {
        frameId = requestAnimationFrame(draw);
        if (!canvas) return;
        if (now - lastFrame < (reduceMotion ? 1000 : 66)) return;
        lastFrame = now;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const px = Math.round(size * dpr);
        if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        painter.clear();
        renderCompact(painter, reduceMotion ? 0 : (now - startedAt) * 0.001, reduceMotion);
        painter.paint(ctx, size / GRID, 0, 0);
    }

    $effect(() => {
        if (typeof window === 'undefined') return;
        reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        startedAt = performance.now();
        frameId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frameId);
    });
</script>

<canvas
    bind:this={canvas}
    style="width:{size}px;height:{size}px"
    class="block"
    aria-hidden="true"
></canvas>
