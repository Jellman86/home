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
        boidCount = 800, 
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
    
    // REFINED BOID PARAMETERS
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.4 : 1.0);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 40 : 50); 
    let PROTECTED_RANGE = $derived(mode === 'fish' ? 10 : 15);
    let VISUAL_RANGE_SQ = $derived(VISUAL_RANGE * VISUAL_RANGE);
    let PROTECTED_RANGE_SQ = $derived(PROTECTED_RANGE * PROTECTED_RANGE);
    const BOUNDARY_SIZE = 150;
    
    // PRIORITY: Alignment > Cohesion to prevent toroidal looping
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 4.0 : 3.0); 
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 3.0 : 4.5); // Very high alignment for directional streaming
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 0.8 : 0.4); // Very low cohesion to prevent center-clumping
    const MOUSE_REPULSION_WEIGHT = 8.0;

    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;

    function init() {
        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(backgroundColor, 70, 300);
        scene.background = new THREE.Color(backgroundColor);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 120;

        renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias: true,
            alpha: true 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        birdGeo = new THREE.ConeGeometry(0.5, 2, 4);
        birdGeo.rotateX(Math.PI / 2);
        
        fishGeo = new THREE.ConeGeometry(0.6, 1.8, 8);
        fishGeo.rotateX(Math.PI / 2);
        fishGeo.scale(0.4, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.6,
        });

        mesh = new THREE.InstancedMesh(mode === 'fish' ? fishGeo : birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);

        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);

        for (let i = 0; i < boidCount; i++) {
            _position.set(
                (Math.random() - 0.5) * BOUNDARY_SIZE * 1.5,
                (Math.random() - 0.5) * BOUNDARY_SIZE * 1.5,
                (Math.random() - 0.5) * BOUNDARY_SIZE * 1.5
            );
            
            _velocity.set(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(SPEED_LIMIT);

            positions[i * 3] = _position.x;
            positions[i * 3 + 1] = _position.y;
            positions[i * 3 + 2] = _position.z;

            velocities[i * 3] = _velocity.x;
            velocities[i * 3 + 1] = _velocity.y;
            velocities[i * 3 + 2] = _velocity.z;

            _dummy.position.copy(_position);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
    }

    $effect(() => {
        if (mesh && birdGeo && fishGeo) {
            mesh.geometry = mode === 'fish' ? fishGeo : birdGeo;
        }
    });

    $effect(() => {
        if (scene && mesh) {
            scene.background = new THREE.Color(backgroundColor);
            scene.fog = new THREE.Fog(backgroundColor, 70, 300);
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.set(color);
        }
    });

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

            let alignmentForce = new THREE.Vector3();
            let cohesionForce = new THREE.Vector3();
            let separationForce = new THREE.Vector3();
            let alignCount = 0;
            let cohereCount = 0;
            let separateCount = 0;

            const SAMPLE_SIZE = 40; 
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
                const dist = Math.sqrt(dSq);

                if (dist < VISUAL_RANGE && dist > 0.0001) {
                    if (dist < PROTECTED_RANGE) {
                        separationForce.x += dx / dist;
                        separationForce.y += dy / dist;
                        separationForce.z += dz / dist;
                        separateCount++;
                    } else {
                        cohesionForce.x += ox;
                        cohesionForce.y += oy;
                        cohesionForce.z += oz;
                        cohereCount++;

                        alignmentForce.x += velocities[otherIdx];
                        alignmentForce.y += velocities[otherIdx + 1];
                        alignmentForce.z += velocities[otherIdx + 2];
                        alignCount++;
                    }
                }
            }

            if (separateCount > 0) {
                separationForce.divideScalar(separateCount).normalize().multiplyScalar(SEPARATION_WEIGHT * 0.1);
                _acceleration.add(separationForce);
            }

            if (cohereCount > 0) {
                cohesionForce.divideScalar(cohereCount).sub(_position).normalize().multiplyScalar(COHESION_WEIGHT * 0.01);
                _acceleration.add(cohesionForce);
            }

            if (alignCount > 0) {
                alignmentForce.divideScalar(alignCount).normalize().sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.05);
                _acceleration.add(alignmentForce);
            }

            const distToMouse = _position.distanceToSquared(target);
            if (distToMouse < 2500) { 
                _diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.02);
                _acceleration.add(_diff);
            }

            // Gentle Inward Push from boundaries
            const margin = BOUNDARY_SIZE * 0.8;
            if (Math.abs(_position.x) > margin) _acceleration.x -= Math.sign(_position.x) * 0.02;
            if (Math.abs(_position.y) > margin) _acceleration.y -= Math.sign(_position.y) * 0.02;
            if (Math.abs(_position.z) > margin) _acceleration.z -= Math.sign(_position.z) * 0.02;

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