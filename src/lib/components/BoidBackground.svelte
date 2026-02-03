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

    // Environmental Effects
    let skyShaderMaterial: THREE.ShaderMaterial;
    let bubbleParticles: THREE.Points;

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
    
    // BOID PARAMETERS
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.4 : 1.0);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 40 : 55); 
    let PROTECTED_RANGE = $derived(mode === 'fish' ? 12 : 18);
    const BOUNDARY_SIZE = 160;
    
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 4.5 : 3.5); 
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 3.5 : 4.0); 
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 0.5 : 0.3); 
    const MOUSE_REPULSION_WEIGHT = 10.0;

    // Cloud/Sky Shader Source (Simplified Volumetric)
    const skyVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const skyFragmentShader = `
        uniform float time;
        uniform vec3 color;
        uniform vec3 bgColor;
        uniform float isFish;
        varying vec2 vUv;

        // Optimized noise for performance
        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
            vec2 uv = vUv * 2.0 - 1.0;
            vec3 finalColor = bgColor;
            
            if (isFish > 0.5) {
                // Sea: Deep water gradient + rays
                float ray = sin(uv.x * 3.0 + time * 0.5) * 0.1;
                finalColor += ray * vec3(0.0, 0.2, 0.3);
            } else {
                // Sky: Stylized Volumetric Clouds
                float cloudTime = time * 0.05;
                vec2 cloudUv = vUv * 3.0;
                float n = noise(floor(cloudUv + cloudTime));
                float f = smoothstep(0.4, 0.7, sin(cloudUv.x + cloudTime) * cos(cloudUv.y - cloudTime * 0.5));
                finalColor = mix(bgColor, vec3(1.0), f * 0.15);
            }
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(backgroundColor);

        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 3000);
        camera.position.z = 160;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Background Sky/Sea Plane
        const skyGeo = new THREE.PlaneGeometry(1000, 1000);
        skyShaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(color) },
                bgColor: { value: new THREE.Color(backgroundColor) },
                isFish: { value: mode === 'fish' ? 1.0 : 0.0 }
            },
            vertexShader: skyVertexShader,
            fragmentShader: skyFragmentShader,
            depthWrite: false
        });
        const sky = new THREE.Mesh(skyGeo, skyShaderMaterial);
        sky.position.z = -500;
        scene.add(sky);

        // Geometries
        const birdGeo = new THREE.ConeGeometry(0.5, 2.2, 4);
        birdGeo.rotateX(Math.PI / 2);
        const fishGeo = new THREE.ConeGeometry(0.6, 1.8, 8);
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

        // Bubbles (Fish Mode)
        const bubbleGeo = new THREE.BufferGeometry();
        const bubbleCount = 300;
        const bubblePos = new Float32Array(bubbleCount * 3);
        for(let i=0; i<bubbleCount; i++) {
            bubblePos[i*3] = (Math.random()-0.5) * 500;
            bubblePos[i*3+1] = (Math.random()-0.5) * 500;
            bubblePos[i*3+2] = (Math.random()-0.5) * 500;
        }
        bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
        bubbleParticles = new THREE.Points(bubbleGeo, new THREE.PointsMaterial({ 
            color: 0xffffff, size: 1.2, transparent: true, opacity: 0.3 
        }));
        scene.add(bubbleParticles);

        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);

        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*BOUNDARY_SIZE*2, (Math.random()-0.5)*BOUNDARY_SIZE*2, (Math.random()-0.5)*BOUNDARY_SIZE*2);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize().multiplyScalar(SPEED_LIMIT);
            positions[i * 3] = _position.x; positions[i * 3 + 1] = _position.y; positions[i * 3 + 2] = _position.z;
            velocities[i * 3] = _velocity.x; velocities[i * 3 + 1] = _velocity.y; velocities[i * 3 + 2] = _velocity.z;
            _dummy.position.copy(_position);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
    }

    $effect(() => {
        if (mesh && skyShaderMaterial) {
            skyShaderMaterial.uniforms.isFish.value = mode === 'fish' ? 1.0 : 0.0;
            bubbleParticles.visible = mode === 'fish';
        }
    });

    $effect(() => {
        if (scene && mesh && skyShaderMaterial) {
            scene.background = new THREE.Color(backgroundColor);
            skyShaderMaterial.uniforms.bgColor.value.set(backgroundColor);
            (mesh.material as THREE.MeshBasicMaterial).color.set(color);
        }
    });

    function animate() {
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; }

        if (skyShaderMaterial) skyShaderMaterial.uniforms.time.value = now * 0.001;

        if (mode === 'fish' && bubbleParticles) {
            const attr = bubbleParticles.geometry.attributes.position as THREE.BufferAttribute;
            for(let i=0; i<attr.count; i++) {
                let y = attr.getY(i) + 0.15;
                if (y > 250) y = -250;
                attr.setY(i, y);
            }
            attr.needsUpdate = true;
        }

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);

            let alignmentForce = new THREE.Vector3(), cohereForce = new THREE.Vector3(), separateForce = new THREE.Vector3();
            let alignCount = 0, cohereCount = 0, separateCount = 0;

            const SAMPLE_SIZE = 35; 
            for (let j = 0; j < SAMPLE_SIZE; j++) {
                let otherIdx = Math.floor(Math.random() * boidCount) * 3;
                if (otherIdx === idx) continue;

                const ox = positions[otherIdx], oy = positions[otherIdx+1], oz = positions[otherIdx+2];
                const dx = _position.x - ox, dy = _position.y - oy, dz = _position.z - oz;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                if (dist < VISUAL_RANGE && dist > 0.01) {
                    if (dist < PROTECTED_RANGE) {
                        separateForce.x += dx / dist; separateForce.y += dy / dist; separateForce.z += dz / dist;
                        separateCount++;
                    } else {
                        cohereForce.x += ox; cohereForce.y += oy; cohereForce.z += oz;
                        cohereCount++;
                        alignmentForce.x += velocities[otherIdx]; alignmentForce.y += velocities[otherIdx+1]; alignmentForce.z += velocities[otherIdx+2];
                        alignCount++;
                    }
                }
            }

            if (separateCount > 0) _acceleration.add(separateForce.divideScalar(separateCount).normalize().multiplyScalar(SEPARATION_WEIGHT * 0.08));
            if (cohereCount > 0) _acceleration.add(cohereForce.divideScalar(cohereCount).sub(_position).normalize().multiplyScalar(COHESION_WEIGHT * 0.01));
            if (alignCount > 0) _acceleration.add(alignmentForce.divideScalar(alignCount).normalize().sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.04));

            const distToMouse = _position.distanceToSquared(target);
            if (distToMouse < 3000) _acceleration.add(_diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.02));

            const limit = BOUNDARY_SIZE * 0.9;
            if (Math.abs(_position.x) > limit) _acceleration.x -= Math.sign(_position.x) * 0.03;
            if (Math.abs(_position.y) > limit) _acceleration.y -= Math.sign(_position.y) * 0.03;
            if (Math.abs(_position.z) > limit) _acceleration.z -= Math.sign(_position.z) * 0.03;

            _acceleration.clampLength(0, 0.04); // SMOOTHING
            _velocity.add(_acceleration).clampLength(0.1, SPEED_LIMIT);
            _position.add(_velocity);

            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;

            _dummy.position.copy(_position);
            if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        renderer.render(scene, camera);
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMount(() => {
        init(); animate();
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousemove', (e) => {
            mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1;
        });
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            if (frameId) cancelAnimationFrame(frameId);
            if (renderer) renderer.dispose();
        }
    });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>