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

    // Layered Environmental Meshes
    let skyMesh: THREE.Mesh;
    let seaMesh: THREE.Mesh;
    let bubbleParticles: THREE.Points;
    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;

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
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.4 : 0.8);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 40 : 50); 
    let PROTECTED_RANGE = $derived(mode === 'fish' ? 10 : 15);
    const BOUNDARY_SIZE = 120;
    
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 4.0 : 3.0); 
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 3.0 : 4.5); 
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 0.8 : 0.4); 
    const MOUSE_REPULSION_WEIGHT = 8.0;

    // Full-screen Quad Vertex Shader
    const bgVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.99, 1.0);
        }
    `;

    // 1. SKY SHADER (Standing Perspective)
    const skyFragmentShader = `
        uniform float time;
        uniform vec3 bgColor;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
                       mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
            return v;
        }

        void main() {
            vec3 zenithColor = vec3(0.01, 0.05, 0.2); 
            vec3 horizonColor = vec3(0.2, 0.5, 0.8);
            vec3 finalColor = mix(horizonColor, zenithColor, pow(vUv.y, 0.7));
            
            float sun = exp(-distance(vUv, vec2(0.8, 0.9)) * 2.5);
            finalColor = mix(finalColor, vec3(1.0, 0.95, 0.85), sun * 0.45);
            
            vec2 cloudP = vUv * vec2(3.0, 1.5);
            cloudP.x += time * 0.02;
            float d = fbm(cloudP * 2.5);
            float mask = smoothstep(0.55, 0.65, d);
            finalColor = mix(finalColor, vec3(1.0), mask * 0.35);
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // 2. SEA SHADER (Vertical Slice)
    const seaFragmentShader = `
        uniform float time;
        uniform vec3 bgColor;
        varying vec2 vUv;

        void main() {
            float surface = smoothstep(0.4, 1.0, vUv.y);
            vec3 topColor = vec3(0.05, 0.3, 0.45);
            vec3 bottomColor = vec3(0.0, 0.05, 0.1);
            vec3 finalColor = mix(bottomColor, topColor, surface);
            
            float rays = pow(sin(vUv.x * 15.0 + time * 0.5) * 0.5 + 0.5, 12.0) * 0.2 * surface;
            finalColor += rays * vec3(0.5, 0.9, 1.0);
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.z = 180;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const bgGeo = new THREE.PlaneGeometry(2, 2);

        // Sky Layer
        skyMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, bgColor: { value: new THREE.Color(backgroundColor) } },
            vertexShader: bgVertexShader, fragmentShader: skyFragmentShader, depthWrite: false
        }));
        skyMesh.visible = (mode === 'bird');
        scene.add(skyMesh);

        // Sea Layer
        seaMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, bgColor: { value: new THREE.Color(backgroundColor) } },
            vertexShader: bgVertexShader, fragmentShader: seaFragmentShader, depthWrite: false
        }));
        seaMesh.visible = (mode === 'fish');
        scene.add(seaMesh);

        // Geometries
        birdGeo = new THREE.ConeGeometry(0.6, 2.5, 4); birdGeo.rotateX(Math.PI / 2);
        fishGeo = new THREE.ConeGeometry(0.7, 2.0, 8); fishGeo.rotateX(Math.PI / 2); fishGeo.scale(0.4, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.8 });
        mesh = new THREE.InstancedMesh(mode === 'fish' ? fishGeo : birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);

        // Bubbles
        const bubbleGeo = new THREE.BufferGeometry();
        const bubbleCount = 400;
        const bubblePos = new Float32Array(bubbleCount * 3);
        for(let i=0; i<bubbleCount; i++) {
            bubblePos[i*3] = (Math.random()-0.5) * 800;
            bubblePos[i*3+1] = (Math.random()-0.5) * 800;
            bubblePos[i*3+2] = (Math.random()-0.5) * 400 - 200;
        }
        bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
        bubbleParticles = new THREE.Points(bubbleGeo, new THREE.PointsMaterial({ 
            color: 0xffffff, size: 3.5, transparent: true, opacity: 0.4, sizeAttenuation: true
        }));
        bubbleParticles.visible = (mode === 'fish');
        scene.add(bubbleParticles);

        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);

        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*BOUNDARY_SIZE*2, (Math.random()-0.5)*BOUNDARY_SIZE*2, (Math.random()-0.5)*BOUNDARY_SIZE);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize().multiplyScalar(SPEED_LIMIT);
            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            _dummy.position.copy(_position); _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
    }

    $effect(() => {
        if (mesh && skyMesh && seaMesh && birdGeo && fishGeo) {
            console.log("Switching mode to:", mode);
            skyMesh.visible = (mode === 'bird');
            seaMesh.visible = (mode === 'fish');
            if (bubbleParticles) bubbleParticles.visible = (mode === 'fish');
            mesh.geometry = (mode === 'fish') ? fishGeo : birdGeo;
            
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.set(color);
        }
    });

    function animate() {
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; }

        const t = now * 0.001;
        if (skyMesh.visible) (skyMesh.material as THREE.ShaderMaterial).uniforms.time.value = t;
        if (seaMesh.visible) (seaMesh.material as THREE.ShaderMaterial).uniforms.time.value = t;

        if (mode === 'fish' && bubbleParticles) {
            const attr = bubbleParticles.geometry.attributes.position as THREE.BufferAttribute;
            for(let i=0; i<attr.count; i++) {
                let y = attr.getY(i) + 0.5; if (y > 400) y = -400; attr.setY(i, y);
                attr.setX(i, attr.getX(i) + Math.sin(now * 0.001 + i) * 0.15);
            }
            attr.needsUpdate = true;
        }

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);

            let alignF = new THREE.Vector3(), cohF = new THREE.Vector3(), sepF = new THREE.Vector3();
            let aC = 0, cC = 0, sC = 0;

            const SAMPLE = 40; 
            for (let j = 0; j < SAMPLE; j++) {
                let oIdx = Math.floor(Math.random() * boidCount) * 3;
                if (oIdx === idx) continue;
                const dx = _position.x - positions[oIdx], dy = _position.y - positions[oIdx+1], dz = _position.z - positions[oIdx+2];
                const dSq = dx*dx + dy*dy + dz*dz;
                const dist = Math.sqrt(dSq);

                if (dist < VISUAL_RANGE && dist > 0.01) {
                    if (dist < PROTECTED_RANGE) {
                        sepF.x += dx / dist; sepF.y += dy / dist; sepF.z += dz / dist; sC++;
                    } else {
                        cohF.x += positions[oIdx]; cohF.y += positions[oIdx+1]; cohF.z += positions[oIdx+2]; cC++;
                        alignF.x += velocities[oIdx]; alignF.y += velocities[oIdx+1]; alignF.z += velocities[oIdx+2]; aC++;
                    }
                }
            }

            if (sC > 0) _acceleration.add(sepF.divideScalar(sC).normalize().multiplyScalar(SEPARATION_WEIGHT * 0.12));
            if (cC > 0) _acceleration.add(cohF.divideScalar(cC).sub(_position).normalize().multiplyScalar(COHESION_WEIGHT * 0.01));
            if (aC > 0) _acceleration.add(alignF.divideScalar(aC).normalize().sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.06));

            const distM = _position.distanceToSquared(target);
            if (distM < 4000) _acceleration.add(_diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.035));

            const lim = BOUNDARY_SIZE * 1.2;
            if (Math.abs(_position.x) > lim) _acceleration.x -= Math.sign(_position.x) * 0.05;
            if (Math.abs(_position.y) > lim) _acceleration.y -= Math.sign(_position.y) * 0.05;
            if (Math.abs(_position.z) > lim) _acceleration.z -= Math.sign(_position.z) * 0.05;

            _acceleration.clampLength(0, 0.04);
            _velocity.add(_acceleration).clampLength(0.2, SPEED_LIMIT);
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