<script lang="ts">
    import BoidBackground from '$lib/components/BoidBackground.svelte';
    
    let mode = $state<'bird' | 'fish'>('bird');
    let fps = $state(0);

    // Theme Configuration - Deeper, more professional colors
    let backgroundColor = $derived(mode === 'bird' ? '#0f172a' : '#01161e'); // Dark Twilight vs Deepest Teal
    let boidColor = $derived(mode === 'bird' ? '#cbd5e1' : '#4fd1c5'); // Muted Silver Birds vs Glowing Fish
</script>

<div class="relative min-h-screen w-full text-white overflow-hidden font-sans transition-colors duration-1000">
    <!-- WebGL Background Layer -->
    <BoidBackground boidCount={600} color={boidColor} {backgroundColor} {mode} bind:fps />

    <!-- UI Overlay -->
    <div class="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 pointer-events-none">
        <main class="pointer-events-auto max-w-2xl w-full text-center space-y-8 backdrop-blur-md bg-white/5 p-12 rounded-3xl border border-white/10 shadow-2xl transition-all hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] duration-500">
            
            <div class="space-y-2">
                <h1 class="text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500 animate-gradient">
                    Jellman86
                </h1>
                <p class="text-xs font-mono uppercase tracking-[0.3em] text-sky-300/80">Infrastructure Engineer</p>
            </div>

            <p class="text-xl text-slate-300 font-light leading-relaxed">
                Work in Progress (Build v1.1.8)
            </p>
            
            <div class="flex flex-wrap gap-4 justify-center pt-8">
                <a href="https://github.com/Jellman86" target="_blank" rel="noopener noreferrer" class="group px-6 py-3 rounded-full bg-white text-slate-900 font-bold hover:scale-105 transition-all flex items-center gap-2">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    GitHub
                </a>
                <a href="https://linkedin.com/in/Jellman86" target="_blank" rel="noopener noreferrer" class="px-6 py-3 rounded-full border border-white/20 hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2">
                    <svg class="w-5 h-5 fill-current text-sky-400" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    LinkedIn
                </a>
                <a href="https://yawamf.pownet.uk" target="_blank" rel="noopener noreferrer" class="px-6 py-3 rounded-full border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 transition-all flex items-center gap-2">
                    <span class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                    </span>
                    YA-WAMF Project
                </a>
            </div>
        </main>
    </div>

    <!-- Controls Overlay -->
    <div class="fixed bottom-6 right-6 z-50 pointer-events-auto flex flex-col gap-3 p-3 rounded-2xl bg-slate-900/50 backdrop-blur-lg border border-white/10 shadow-lg min-w-[150px]">
        <div class="flex items-center justify-between gap-4">
            <div class="flex bg-slate-800/80 rounded-lg p-1">
                <button
                    class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {mode === 'bird' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}"
                    onclick={() => mode = 'bird'}
                >
                    Birds
                </button>
                <button
                    class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {mode === 'fish' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}"
                    onclick={() => mode = 'fish'}
                >
                    Fish
                </button>
            </div>
            <div class="px-2 border-l border-white/10">
                <p class="text-[10px] font-mono font-bold text-slate-400">
                    <span class="text-sky-400 text-sm">{fps}</span> FPS
                </p>
            </div>
        </div>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
    }
    
    .animate-gradient {
        background-size: 200% auto;
        animation: shine 4s linear infinite;
    }
    
    @keyframes shine {
        to {
            background-position: 200% center;
        }
    }
</style>
