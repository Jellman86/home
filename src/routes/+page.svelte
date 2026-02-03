<script lang="ts">
    import { onMount } from 'svelte';
    
    let canvas: HTMLCanvasElement;

    onMount(() => {
        // Initialize Three.js scene here later
        console.log("Mounted");
    });
</script>

<div class="relative min-h-screen w-full bg-slate-900 text-white overflow-hidden font-sans">
    <!-- WebGL Background Layer -->
    <canvas bind:this={canvas} class="absolute inset-0 w-full h-full z-0 opacity-50"></canvas>

    <!-- UI Overlay -->
    <div class="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 pointer-events-none">
        <main class="pointer-events-auto max-w-2xl w-full text-center space-y-8 backdrop-blur-md bg-white/5 p-12 rounded-3xl border border-white/10 shadow-2xl">
            <h1 class="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                Hello, World.
            </h1>
            <p class="text-xl text-slate-300 font-light leading-relaxed">
                Welcome to my digital garden.
                <br>
                <span class="text-sm opacity-50 font-mono mt-4 block">Simulation initializing...</span>
            </p>
            
            <div class="flex gap-4 justify-center pt-8">
                <button class="px-6 py-3 rounded-full bg-white text-slate-900 font-bold hover:scale-105 transition-transform">
                    Projects
                </button>
                <button class="px-6 py-3 rounded-full border border-white/20 hover:bg-white/10 transition-colors">
                    Contact
                </button>
            </div>
        </main>
    </div>
</div>