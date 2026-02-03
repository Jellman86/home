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
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.6 : 1.2);
    let MIN_SPEED = $derived(mode === 'fish' ? 0.2 : 0.5);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 40 : 80);
    let PROTECTED_RANGE = $derived(mode === 'fish' ? 15 : 20); // Separation distance
    
    // Smoothing factor - THE CURE FOR JIGGLING
    // Limits how much a boid can change its velocity per frame
    const MAX_STEER_FORCE = 0.05; 
    
    // Weights
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 2.5 : 1.5); 
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 1.5 : 1.5); 
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 0.1 : 1.0); 
    const MOUSE_REPULSION_WEIGHT = 10.0;
    const BOUNDARY_SIZE = 200; 

    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;

    function init() {
        scene = new THREE.Scene();
        
        // Mode-specific Fog - Pulled closer for zoomed view
        const fogNear = mode === 'fish' ? 20 : 50;
        const fogFar = mode === 'fish' ? 300 : 600;
        scene.fog = new THREE.Fog(backgroundColor, fogNear, fogFar);
        scene.background = new THREE.Color(backgroundColor);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.z = 180; // Zoomed in

        renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias: true,
            alpha: true 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Slightly larger for better visibility when zoomed
        birdGeo = new THREE.ConeGeometry(0.7, 2.5, 4);
        birdGeo.rotateX(Math.PI / 2);
        
        fishGeo = new THREE.ConeGeometry(0.8, 2.2, 8);
        fishGeo.rotateX(Math.PI / 2);
        fishGeo.scale(0.4, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.8,
        });

        mesh = new THREE.InstancedMesh(mode === 'fish' ? fishGeo : birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);

        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);

        for (let i = 0; i < boidCount; i++) {
            _position.set(
                (Math.random() - 0.5) * BOUNDARY_SIZE,
                (Math.random() - 0.5) * BOUNDARY_SIZE,
                (Math.random() - 0.5) * BOUNDARY_SIZE
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
        if (camera) {
            camera.position.z = 180;
        }
    });

    $effect(() => {
        if (scene && mesh) {
            const fogNear = mode === 'fish' ? 20 : 50;
            const fogFar = mode === 'fish' ? 300 : 600;
            scene.fog = new THREE.Fog(backgroundColor, fogNear, fogFar);

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

        // Project mouse at fixed depth
        const vFOV = THREE.MathUtils.degToRad(camera.fov);
        const hAtDepth = 2 * Math.tan(vFOV / 2) * camera.position.z;
        const wAtDepth = hAtDepth * camera.aspect;
        
        target.set(
            (mouse.x * wAtDepth) / 2,
            (mouse.y * hAtDepth) / 2,
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

            const SAMPLE_SIZE = 40; 
            for (let j = 0; j < SAMPLE_SIZE; j++) {
                let otherIdx = Math.floor(Math.random() * boidCount);
                if (otherIdx === i) continue;
                otherIdx *= 3;

                _diff.set(positions[otherIdx], positions[otherIdx + 1], positions[otherIdx + 2]);
                const dist = _position.distanceTo(_diff);

                // Separation (Avoidance) - Priority
                if (dist < PROTECTED_RANGE && dist > 0.001) {
                    _diff.copy(_position).sub(_diff).normalize().divideScalar(dist);
                    separation.add(_diff);
                    sepCount++;
                } 
                // Alignment & Cohesion - Secondary
                else if (dist < VISUAL_RANGE) {
                    cohesion.add(_diff);
                    _diff.set(velocities[otherIdx], velocities[otherIdx + 1], velocities[otherIdx + 2]);
                    alignment.add(_diff);
                    count++;
                }
            }

            if (sepCount > 0) {
                separation.normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).multiplyScalar(SEPARATION_WEIGHT);
                _acceleration.add(separation);
            }

            if (count > 0) {
                alignment.divideScalar(count).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT);
                cohesion.divideScalar(count).sub(_position).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).multiplyScalar(COHESION_WEIGHT);

                _acceleration.add(alignment);
                _acceleration.add(cohesion);
            }

            // Mouse Repulsion
            const distToMouse = _position.distanceTo(target);
            if (distToMouse < 100) { 
                _diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT);
                _acceleration.add(_diff);
            }

            // Boundary
            const d = _position.length();
            if (d > BOUNDARY_SIZE) {
                _diff.copy(_position).negate().normalize().multiplyScalar((d - BOUNDARY_SIZE) * 0.02);
                _acceleration.add(_diff);
            }

            // Apply steering force smoothly
            _acceleration.clampLength(0, MAX_STEER_FORCE);
            _velocity.add(_acceleration).clampLength(MIN_SPEED, SPEED_LIMIT);
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