<script lang="ts">
    import BoidBackground from '$lib/components/BoidBackground.svelte';
    
    const mode = 'bird';
    let fps = $state(0);
    const gitHash = 'f4783c9';

    // Theme Configuration - Deeper, more professional colors
    let backgroundColor = $derived(mode === 'bird' ? '#0f172a' : '#01161e'); // Dark Twilight vs Deepest Teal
    let boidColor = $derived('#1a212d'); // Birds only
</script>

<svelte:head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="relative min-h-screen w-full text-white overflow-hidden font-sans transition-colors duration-1000">
    <!-- WebGL Background Layer -->
    <BoidBackground boidCount={300} color={boidColor} {backgroundColor} bind:fps />

    <!-- UI Overlay removed for simulation review -->

    <!-- Controls Overlay -->
    <div class="fixed bottom-6 right-6 z-50 pointer-events-auto flex flex-col gap-2 px-3 py-2 rounded-2xl bg-slate-900/50 backdrop-blur-lg border border-white/10 shadow-lg min-w-[110px]">
        <p class="text-[10px] font-mono font-bold text-slate-400">
            <span class="text-sky-400 text-sm">{fps}</span> FPS
        </p>
        <p class="text-[9px] font-mono text-slate-500">
            {gitHash}
        </p>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
        font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
    }

    :global(.font-mono) {
        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        letter-spacing: 0.2em;
    }
</style>
