<script lang="ts">
    import { fade } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-mono text-green-500 selection:bg-green-500/30 overflow-hidden" in:fade={{ duration: 100 }}>
    <!-- CRT Overlay -->
    <div class="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] bg-[length:100%_4px,6px_100%] opacity-20"></div>
    <div class="fixed inset-0 pointer-events-none z-50 bg-[radial-gradient(circle,rgba(0,0,0,0)_60%,rgba(0,0,0,0.6)_100%)]"></div>

    <div class="relative z-10 w-full max-w-4xl bg-black border-2 border-green-700/50 p-6 shadow-[0_0_20px_rgba(0,255,0,0.1)]">
        <!-- Terminal Header -->
        <div class="flex justify-between items-center border-b border-green-800 pb-4 mb-6">
            <div class="flex gap-2">
                <div class="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div class="w-3 h-3 rounded-full bg-green-500/50"></div>
            </div>
            <div class="text-xs text-green-700 font-bold uppercase tracking-widest">usr@pownet:~</div>
        </div>

        <div class="grid md:grid-cols-[1fr_250px] gap-8">
            <!-- Content -->
            <div class="space-y-6">
                <div>
                    <div class="flex items-center gap-2 text-green-300 mb-2">
                        <span class="text-green-700">➜</span>
                        <span class="font-bold">whoami</span>
                    </div>
                    <h1 class="text-3xl md:text-4xl font-bold mb-1 text-green-400 text-shadow">{data.name}</h1>
                    <p class="text-green-600 text-sm">Infrastructure Engineer // UK</p>
                </div>

                <div>
                    <div class="flex items-center gap-2 text-green-300 mb-2">
                        <span class="text-green-700">➜</span>
                        <span class="font-bold">cat bio.txt</span>
                    </div>
                    <p class="leading-relaxed text-green-500/90 border-l-2 border-green-800 pl-4 py-1">
                        {data.bio}
                        <span class="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1 align-middle"></span>
                    </p>
                </div>

                <div>
                    <div class="flex items-center gap-2 text-green-300 mb-2">
                        <span class="text-green-700">➜</span>
                        <span class="font-bold">ls -la ./links</span>
                    </div>
                    <div class="flex flex-col gap-2">
                        {#each data.links as link}
                            <a href={link.url} target="_blank" class="group flex items-center gap-3 hover:bg-green-900/20 p-2 -mx-2 rounded transition-colors">
                                <span class="text-green-700 text-xs">drwxr-xr-x</span>
                                <span class="text-green-400 font-bold group-hover:underline decoration-green-500/50 underline-offset-4">{link.label}</span>
                                <span class="text-green-800 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity">-> {link.url.replace('https://', '')}</span>
                            </a>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Avatar / System Info -->
            <div class="flex flex-col gap-6">
                <div class="relative aspect-square border border-green-800 bg-green-900/10 p-1">
                    <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover grayscale contrast-125 brightness-75 sepia-[.5] hue-rotate-[50deg] saturate-[3]" />
                    <div class="absolute inset-0 bg-green-500/10 mix-blend-overlay"></div>
                    <!-- Corner brackets -->
                    <div class="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-500"></div>
                    <div class="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-500"></div>
                    <div class="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-500"></div>
                    <div class="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-500"></div>
                </div>

                <div class="text-xs text-green-600 space-y-1 font-mono">
                    <div class="flex justify-between"><span>UPTIME</span> <span>99.99%</span></div>
                    <div class="flex justify-between"><span>CPU</span> <span>12%</span></div>
                    <div class="flex justify-between"><span>MEM</span> <span>4.2GB</span></div>
                    <div class="border-t border-green-900 my-2"></div>
                    <div class="flex justify-between text-green-400"><span>STATUS</span> <span>ONLINE</span></div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .text-shadow {
        text-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
    }
</style>