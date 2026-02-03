<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';

    interface Props {
        boidCount?: number;
        color?: string;
        backgroundColor?: string;
        mode?: 'bird' | 'fish';
        fps?: number;
    }

    let { 
        boidCount = 1200, 
        color = '#00ffff',
        backgroundColor = '#0f172a',
        mode = 'bird',
        fps = $bindable(0)
    }: Props = $props();

    let container: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let mesh: THREE.InstancedMesh;
    let frameId: number;

    let lastTime = performance.now();
    let frameCount = 0;

    let positions: Float32Array;
    let velocities: Float32Array;
    
    const _position = new THREE.Vector3();
    const _velocity = new THREE.Vector3();
    const _acceleration = new THREE.Vector3();
    const _dummy = new THREE.Object3D();
    const _diff = new THREE.Vector3();
    const _lookAt = new THREE.Vector3();

    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    
    // DIFFERENTIATED BOID PARAMETERS
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.4 : 0.8);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 40 : 35);
    let PROTECTED_RANGE = 12; // Radius to keep clear of others
    let VISUAL_RANGE_SQ = $derived(VISUAL_RANGE * VISUAL_RANGE);
    let PROTECTED_RANGE_SQ = PROTECTED_RANGE * PROTECTED_RANGE;
    const BOUNDARY_SIZE = 120;
    
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 3.5 : 2.5); // High weight to maintain min distance
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 4.0 : 2.0); // High alignment for sync
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 1.0 : 1.0); // Balanced cohesion
    const MOUSE_REPULSION_WEIGHT = 5.0;

    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;

    function init() {
        // ... renderer and scene init ...
    }

    // ... reactive effects ...

    function animate() {
        frameId = requestAnimationFrame(animate);

        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (now - lastTime));
            frameCount = 0;
            lastTime = now;
        }

        target.set(
            (mouse.x * window.innerWidth) / 20,
            -(mouse.y * window.innerHeight) / 20,
            0
        );

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);

            let alignment = new THREE.Vector3();
            let cohesion = new THREE.Vector3();
            let separation = new THREE.Vector3();
            let count = 0;
            let sepCount = 0;

            const SAMPLE_SIZE = 50; 
            for (let j = 0; j < SAMPLE_SIZE; j++) {
                let otherIdx = Math.floor(Math.random() * boidCount);
                if (otherIdx === i) continue;
                otherIdx *= 3;

                const ox = positions[otherIdx];
                const oy = positions[otherIdx + 1];
                const oz = positions[otherIdx + 2];
                
                const dx = _position.x - ox;
                const dy = _position.y - oy;
                const dz = _position.z - oz;
                const dSq = dx*dx + dy*dy + dz*dz;

                if (dSq < VISUAL_RANGE_SQ && dSq > 0.0001) {
                    // Rule 1: Separation - Keep distance from neighbors who are too close
                    if (dSq < PROTECTED_RANGE_SQ) {
                        separation.x += dx;
                        separation.y += dy;
                        separation.z += dz;
                        sepCount++;
                    } 
                    // Rule 2 & 3: Alignment & Cohesion - Stay near and move with neighbors
                    else {
                        cohesion.x += ox;
                        cohesion.y += oy;
                        cohesion.z += oz;

                        alignment.x += velocities[otherIdx];
                        alignment.y += velocities[otherIdx + 1];
                        alignment.z += velocities[otherIdx + 2];
                        count++;
                    }
                }
            }

            // Apply Forces
            if (sepCount > 0) {
                _acceleration.add(separation.multiplyScalar(SEPARATION_WEIGHT * 0.05));
            }

            if (count > 0) {
                // Cohesion: Steer towards average position
                cohesion.divideScalar(count).sub(_position).multiplyScalar(COHESION_WEIGHT * 0.02);
                _acceleration.add(cohesion);

                // Alignment: Steer towards average velocity
                alignment.divideScalar(count).sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.05);
                _acceleration.add(alignment);
            }

            const distToMouse = _position.distanceToSquared(target);
            if (distToMouse < 2500) { 
                _diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.02);
                _acceleration.add(_diff);
            }

            // Boundary logic
            if (_position.lengthSq() > (BOUNDARY_SIZE * BOUNDARY_SIZE)) {
                _diff.copy(_position).negate().normalize().multiplyScalar(0.02);
                _acceleration.add(_diff);
            }

            _velocity.add(_acceleration).clampLength(0, SPEED_LIMIT);
            _position.add(_velocity);

            positions[idx] = _position.x;
            positions[idx + 1] = _position.y;
            positions[idx + 2] = _position.z;
            velocities[idx] = _velocity.x;
            velocities[idx + 1] = _velocity.y;
            velocities[idx + 2] = _velocity.z;

            _dummy.position.copy(_position);
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