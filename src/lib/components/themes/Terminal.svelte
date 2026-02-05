<script lang="ts">
    import { fade, slide } from 'svelte/transition';
    import { spring } from 'svelte/motion';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();

    let position = $state({ x: 0, y: 0 });
    let isDragging = $state(false);
    let isMinimized = $state(false);
    let dragOffset = { x: 0, y: 0 };

    function handleMouseDown(e: MouseEvent) {
        if (e.target instanceof Element && e.target.closest('button')) return; 
        
        isDragging = true;
        dragOffset = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging) return;
        position.x = e.clientX - dragOffset.x;
        position.y = e.clientY - dragOffset.y;
    }

    function handleMouseUp() {
        isDragging = false;
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
    }
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="flex items-center justify-center min-h-screen p-4 font-mono text-gray-200 overflow-hidden" in:fade={{ duration: 200 }}>
    <!-- Modern Terminal Window (Ubuntu/Gnome style) -->
    <div 
        class="relative w-full max-w-4xl bg-[#2e3436]/85 backdrop-blur-md rounded-lg shadow-2xl overflow-hidden border border-black/50 pointer-events-auto"
        style="transform: translate({position.x}px, {position.y}px); transition: transform {isDragging ? '0s' : '0.1s'}, height 0.3s;"
    >
        <!-- Title Bar -->
        <div 
            class="bg-[#3e3e3e] px-4 py-2 flex justify-between items-center cursor-grab active:cursor-grabbing select-none border-b border-black/20 h-10"
            onmousedown={handleMouseDown}
            role="button"
            tabindex="0"
        >
            <div class="w-16"></div> <!-- Spacer for center alignment -->
            <div class="text-sm text-gray-400 font-bold tracking-wide">scott@pownet: ~</div>
            <div class="flex gap-3 w-16 justify-end">
                <!-- Minimize (Functional) -->
                <button 
                    onclick={toggleMinimize}
                    class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none"
                    title={isMinimized ? "Restore" : "Minimize"}
                >
                    <div class="w-2.5 h-0.5 bg-current rounded-full"></div>
                </button>
                <!-- Maximize (Fake) -->
                <div class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-default">
                    <div class="w-2.5 h-2.5 border border-current rounded-[1px]"></div>
                </div>
                <!-- Close (Fake) -->
                <div class="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-[#e81123] hover:text-white rounded-full transition-colors cursor-default">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
            </div>
        </div>

        {#if !isMinimized}
        <div class="p-6 grid md:grid-cols-[1fr_250px] gap-8" transition:slide={{ duration: 200 }}>
            <!-- Content -->
            <div class="space-y-6">
                <!-- Command 1: whoami -->
                <div>
                    <div class="flex gap-2 mb-1">
                        <span class="text-[#8ae234] font-bold">scott@pownet</span><span class="text-white">:</span><span class="text-[#729fcf] font-bold">~</span><span class="text-white">$</span>
                        <span>whoami</span>
                    </div>
                    <div class="text-white font-bold pl-4">
                        {data.name}
                    </div>
                    <div class="text-gray-400 pl-4 text-sm">
                        Infrastructure Engineer
                    </div>
                </div>

                <!-- Command 2: cat bio.txt -->
                <div>
                    <div class="flex gap-2 mb-1">
                        <span class="text-[#8ae234] font-bold">scott@pownet</span><span class="text-white">:</span><span class="text-[#729fcf] font-bold">~</span><span class="text-white">$</span>
                        <span>cat bio.txt</span>
                    </div>
                    <div class="text-gray-300 leading-relaxed pl-4 max-w-lg">
                        {data.bio}
                    </div>
                </div>

                <!-- Command 3: ls -->
                <div>
                    <div class="flex gap-2 mb-1">
                        <span class="text-[#8ae234] font-bold">scott@pownet</span><span class="text-white">:</span><span class="text-[#729fcf] font-bold">~</span><span class="text-white">$</span>
                        <span>ls -1 ./links/</span>
                    </div>
                    <div class="flex flex-col gap-1 pl-4">
                        {#each data.links as link}
                            <a href={link.url} target="_blank" class="text-[#729fcf] hover:underline hover:text-[#3465a4] w-fit flex items-center gap-2">
                                {link.label} <span class="text-gray-500 text-xs">-> {link.url}</span>
                            </a>
                        {/each}
                        
                        <!-- Blinking Cursor -->
                        <div class="flex gap-2 mt-4">
                            <span class="text-[#8ae234] font-bold">scott@pownet</span><span class="text-white">:</span><span class="text-[#729fcf] font-bold">~</span><span class="text-white">$</span>
                            <span class="w-2 h-5 bg-white animate-pulse"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Avatar Side -->
            <div class="hidden md:flex flex-col items-center">
                <div class="p-1 bg-white/10 rounded">
                    <img src={data.avatarUrl} alt={data.name} class="w-48 h-48 object-cover rounded" />
                </div>
                <div class="mt-4 w-full bg-[#555753] h-32 rounded p-2 text-[10px] text-white font-mono overflow-hidden">
                    <div class="flex justify-between"><span class="text-[#8ae234]">top - 10:23:45</span> <span>up 14 days</span></div>
                    <div>Tasks: 12 total, 1 running</div>
                    <div class="mt-1">
                        <div class="flex justify-between"><span>PID USER</span> <span>%CPU</span> <span>COMMAND</span></div>
                        <div class="flex justify-between text-[#ef2929]"><span>1337 scott</span> <span>12.4</span> <span>boids</span></div>
                        <div class="flex justify-between"><span>1010 root</span> <span>0.8</span> <span>dockerd</span></div>
                        <div class="flex justify-between"><span>1011 root</span> <span>0.2</span> <span>containerd</span></div>
                        <div class="flex justify-between"><span>1042 scott</span> <span>0.1</span> <span>zsh</span></div>
                    </div>
                </div>
            </div>
        </div>
        {/if}
    </div>
</div>