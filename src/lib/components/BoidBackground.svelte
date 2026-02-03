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
        boidCount = 1000, 
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
    
    // TRUE INITIAL PARAMETERS
    const SPEED_LIMIT = 0.8;
    const VISUAL_RANGE = 25;
    const VISUAL_RANGE_SQ = VISUAL_RANGE * VISUAL_RANGE;
    const BOUNDARY_SIZE = 120;
    
    const SEPARATION_WEIGHT = 2.0;
    const ALIGNMENT_WEIGHT = 1.0;
    const COHESION_WEIGHT = 1.0;
    const MOUSE_REPULSION_WEIGHT = 5.0;

    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;

    function init() {
        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(backgroundColor, 50, 200);
        scene.background = new THREE.Color(backgroundColor);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 80;

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
            scene.fog = new THREE.Fog(backgroundColor, 50, 200);
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

            let alignment = new THREE.Vector3();
            let cohesion = new THREE.Vector3();
            let separation = new THREE.Vector3();
            let count = 0;

            const SAMPLE_SIZE = 50; 
            for (let j = 0; j < SAMPLE_SIZE; j++) {
                let otherIdx = Math.floor(Math.random() * boidCount);
                if (otherIdx === i) continue;
                otherIdx *= 3;

                _diff.set(positions[otherIdx], positions[otherIdx + 1], positions[otherIdx + 2]);
                const distSq = _position.distanceToSquared(_diff);

                if (distSq < VISUAL_RANGE_SQ && distSq > 0.0001) {
                    cohesion.add(_diff);
                    _diff.set(velocities[otherIdx], velocities[otherIdx + 1], velocities[otherIdx + 2]);
                    alignment.add(_diff);

                    _diff.set(positions[otherIdx], positions[otherIdx + 1], positions[otherIdx + 2]);
                    _diff.sub(_position).negate().normalize().divideScalar(Math.sqrt(distSq));
                    separation.add(_diff);
                    count++;
                }
            }

            if (count > 0) {
                alignment.divideScalar(count).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).clampLength(0, 0.05);
                cohesion.divideScalar(count).sub(_position).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).clampLength(0, 0.05);
                separation.divideScalar(count).normalize().multiplyScalar(SPEED_LIMIT).sub(_velocity).clampLength(0, 0.05);

                _acceleration.add(alignment.multiplyScalar(ALIGNMENT_WEIGHT));
                _acceleration.add(cohesion.multiplyScalar(COHESION_WEIGHT));
                _acceleration.add(separation.multiplyScalar(SEPARATION_WEIGHT));
            }

            const distToMouse = _position.distanceToSquared(target);
            if (distToMouse < 2500) { 
                _diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT);
                _acceleration.add(_diff);
            }

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