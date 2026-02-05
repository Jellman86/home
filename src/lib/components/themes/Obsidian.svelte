<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4" in:fade={{ duration: 500 }}>
    <div class="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl p-8 md:p-12">
        <!-- Glow effects -->
        <div class="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none mix-blend-screen"></div>
        <div class="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none mix-blend-screen"></div>

        <div class="relative z-10 flex flex-col items-center text-center">
            <!-- Avatar -->
            <div class="relative mb-6 group">
                <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img 
                    src={data.avatarUrl} 
                    alt={data.name} 
                    class="relative w-32 h-32 rounded-full border-2 border-white/20 object-cover shadow-xl"
                />
            </div>

            <!-- Text -->
            <h1 class="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-2 font-display">
                {data.name}
            </h1>
            <p class="text-lg text-slate-300 font-light mb-8 max-w-lg leading-relaxed">
                {data.bio}
            </p>

            <!-- Grid Links -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {#each data.links as link, i}
                    <a 
                        href={link.url} 
                        target="_blank"
                        class="group relative overflow-hidden p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/10 flex flex-col items-center justify-center gap-2"
                        in:fly={{ y: 20, delay: 200 + (i * 100) }}
                    >
                        <span class="text-2xl opacity-70 group-hover:opacity-100 transition-opacity">{link.icon}</span>
                        <span class="font-medium text-slate-200 tracking-wide">{link.label}</span>
                        <div class="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                    </a>
                {/each}
            </div>
        </div>
    </div>
</div>
