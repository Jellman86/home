<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';

    interface Props {
        boidCount?: number;
        color?: string;
        backgroundColor?: string;
        mode?: 'bird' | 'fish';
        fps?: number;
        zoom?: number;
    }

    let { 
        boidCount = 800, 
        color = '#00ffff',
        backgroundColor = '#0f172a', // slate-900 matches app theme
        mode = 'bird',
        fps = $bindable(0),
        zoom = 120
    }: Props = $props();

    let container: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    
    // Three.js variables
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let mesh: THREE.InstancedMesh;
    let frameId: number;

    // FPS calculation
    let lastTime = performance.now();
    let frameCount = 0;

    // Simulation State
    // Using Float32Arrays for performance (Struct of Arrays layout)
    let positions: Float32Array;
    let velocities: Float32Array;
    
    // Scratch variables to avoid GC
    const _position = new THREE.Vector3();
    const _velocity = new THREE.Vector3();
    const _acceleration = new THREE.Vector3();
    const _dummy = new THREE.Object3D();
    const _diff = new THREE.Vector3();
    const _lookAt = new THREE.Vector3();

    // Mouse interaction
    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    
    // Boid Parameters - Reactive based on mode
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.4 : 0.8);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 50 : 25);
    let VISUAL_RANGE_SQ = $derived(VISUAL_RANGE * VISUAL_RANGE);
    const BOUNDARY_SIZE = 120; // World size
    
    // Rule weights - Reactive based on mode
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 1.5 : 1.5);
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 3.0 : 1.0);
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 2.0 : 1.0);
    const MOUSE_REPULSION_WEIGHT = 5.0;

    // Geometries
    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;

    function init() {
        // Scene setup
        scene = new THREE.Scene();
        // Fog for depth and to hide boundaries
        scene.fog = new THREE.Fog(backgroundColor, 70, 250);
        scene.background = new THREE.Color(backgroundColor);

        // Camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = zoom;

        // Renderer
        renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias: true,
            alpha: true // Allow CSS background to show through
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Define Geometries
        
        // 1. Bird: Paper Airplane / Arrow (Low Poly)
        birdGeo = new THREE.ConeGeometry(0.5, 2, 4);
        birdGeo.rotateX(Math.PI / 2); // Point forward
        
        // 2. Fish: Thinner, rounder (Higher Poly)
        fishGeo = new THREE.ConeGeometry(0.6, 1.8, 8);
        fishGeo.rotateX(Math.PI / 2);
        fishGeo.scale(0.4, 1, 1); // Flatten width (streamlined)
        
        // Material
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.8,
        });

        // Instanced Mesh
        mesh = new THREE.InstancedMesh(mode === 'fish' ? fishGeo : birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Optimizing for frequent updates
        scene.add(mesh);

        // Initialize Data
        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);

        for (let i = 0; i < boidCount; i++) {
            // Random positions within cube
            _position.set(
                (Math.random() - 0.5) * BOUNDARY_SIZE * 1.5,
                (Math.random() - 0.5) * BOUNDARY_SIZE * 1.5,
                (Math.random() - 0.5) * BOUNDARY_SIZE * 1.5
            );
            
            // Random velocities
            _velocity.set(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(SPEED_LIMIT);

            // Store
            positions[i * 3] = _position.x;
            positions[i * 3 + 1] = _position.y;
            positions[i * 3 + 2] = _position.z;

            velocities[i * 3] = _velocity.x;
            velocities[i * 3 + 1] = _velocity.y;
            velocities[i * 3 + 2] = _velocity.z;

            // Initial dummy transform
            _dummy.position.copy(_position);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
        
        // Interactive light (optional/subtle)
        const light = new THREE.DirectionalLight(0xffffff, 0.5);
        light.position.set(10, 10, 10);
        scene.add(light);
    }

    // Reactive Geometry Swap
    $effect(() => {
        if (mesh && birdGeo && fishGeo) {
            mesh.geometry = mode === 'fish' ? fishGeo : birdGeo;
        }
    });

    // Reactive Zoom
    $effect(() => {
        if (camera) {
            camera.position.z = zoom;
        }
    });

    // Reactive Color Update
    $effect(() => {
        if (mesh) {
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.set(color);
        }
    });

    function animate() {
        frameId = requestAnimationFrame(animate);

        // FPS Calculation
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (now - lastTime));
            frameCount = 0;
            lastTime = now;
        }

        // Map mouse 2D to 3D plane at z=0 approx
        // Simple projection for repulsion effect
        target.set(
            (mouse.x * window.innerWidth) / 20, // Approximate scale factor
            -(mouse.y * window.innerHeight) / 20,
            0
        );

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);

            // 1. Rules (Simulated for local neighborhood)
            // Ideally we'd use a spatial grid (Octree) for performance, 
            // but for < 2000 boids, brute force O(N^2) with distance check is acceptable in JS on modern devices.
            // We'll optimize by only checking a subset or random sample if needed, but let's try raw first.
            
            let alignment = new THREE.Vector3();
            let cohesion = new THREE.Vector3();
            let separation = new THREE.Vector3();
            let count = 0;

            // Simple Optimization: Only check every Nth boid or a limited random sample to simulate limited perception
            // Or just check fewer neighbors for background effect.
            // Let's iterate all but break early if we find enough neighbors to simplify logic?
            // Actually, for 1500, full N^2 is approx 2.25M ops/frame. JS might struggle at 60fps.
            // Let's implement a random sampling approach. "Boids don't see EVERYONE".
            // They see random 50 flockmates.
            
            const SAMPLE_SIZE = 50;
            
            for (let j = 0; j < SAMPLE_SIZE; j++) {
                // Pick a random other boid
                let otherIdx = Math.floor(Math.random() * boidCount);
                if (otherIdx === i) continue;
                otherIdx *= 3;

                _diff.set(positions[otherIdx], positions[otherIdx + 1], positions[otherIdx + 2]); // other pos
                const distSq = _position.distanceToSquared(_diff);

                if (distSq < VISUAL_RANGE_SQ && distSq > 0.0001) {
                    // Cohesion: Accumulate position
                    cohesion.add(_diff);

                    // Alignment: Accumulate velocity
                    _diff.set(velocities[otherIdx], velocities[otherIdx + 1], velocities[otherIdx + 2]);
                    alignment.add(_diff);

                    // Separation: Vector away from neighbor
                    _diff.set(positions[otherIdx], positions[otherIdx + 1], positions[otherIdx + 2]); // Get pos again
                    _diff.sub(_position).negate().normalize().divideScalar(Math.sqrt(distSq)); // Weight by distance
                    separation.add(_diff);

                    count++;
                }
            }

            if (count > 0) {
                // Average out
                alignment.divideScalar(count).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).clampLength(0, 0.05);
                cohesion.divideScalar(count).sub(_position).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).clampLength(0, 0.05);
                separation.divideScalar(count).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).clampLength(0, 0.05);

                _acceleration.add(alignment.multiplyScalar(ALIGNMENT_WEIGHT));
                _acceleration.add(cohesion.multiplyScalar(COHESION_WEIGHT));
                _acceleration.add(separation.multiplyScalar(SEPARATION_WEIGHT));
            }

            // Mouse Repulsion (Predator)
            const distToMouse = _position.distanceToSquared(target);
            if (distToMouse < 2500) { // 50 units range
                _diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT);
                _acceleration.add(_diff);
            }

            // Soft Boundaries (Centering force)
            if (_position.lengthSq() > (BOUNDARY_SIZE * BOUNDARY_SIZE)) {
                _diff.copy(_position).negate().normalize().multiplyScalar(0.02);
                _acceleration.add(_diff);
            }

            // Update Physics
            _velocity.add(_acceleration).clampLength(0, SPEED_LIMIT);
            _position.add(_velocity);

            // Write back to arrays
            positions[idx] = _position.x;
            positions[idx + 1] = _position.y;
            positions[idx + 2] = _position.z;
            velocities[idx] = _velocity.x;
            velocities[idx + 1] = _velocity.y;
            velocities[idx + 2] = _velocity.z;

            // Update Mesh Matrix
            _dummy.position.copy(_position);
            
            // Look ahead
            if (_velocity.lengthSq() > 0.0001) {
                _lookAt.copy(_position).add(_velocity);
                _dummy.lookAt(_lookAt);
            }
            
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        renderer.render(scene, camera);
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onMouseMove(event: MouseEvent) {
        // Normalized coordinates -1 to +1
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onMount(() => {
        init();
        animate();
        
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousemove', onMouseMove);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('mousemove', onMouseMove);
            if (frameId) cancelAnimationFrame(frameId);
            if (renderer) renderer.dispose();
        }
    });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0 pointer-events-none">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>
