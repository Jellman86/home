<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';

    interface Props {
        boidCount?: number;
        color?: string;
        backgroundColor?: string;
        // mode removed: birds-only scene
        fps?: number;
    }

    let { 
        boidCount = 800, 
        color = '#00ffff',
        backgroundColor = '#0f172a',
        fps = $bindable(0)
    }: Props = $props();

    const mode: 'bird' = 'bird';

    let container: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let mesh: THREE.InstancedMesh;
    let frameId: number;

    let bgMesh: THREE.Mesh;
    let bubbleParticles: THREE.Points;
    let birdGeo: THREE.BufferGeometry;
    let fishGeo: THREE.BufferGeometry;
    let grassMesh: THREE.InstancedMesh;
    let grassPositions: Float32Array;
    let grassPhase: Float32Array;
    // Volumetric clouds are now handled in the shader

    let lastTime = performance.now();
    let frameCount = 0;

    let positions: Float32Array;
    let velocities: Float32Array;
    let scales: Float32Array;
    
    const _position = new THREE.Vector3();
    const _velocity = new THREE.Vector3();
    const _acceleration = new THREE.Vector3();
    const _dummy = new THREE.Object3D();
    const _diff = new THREE.Vector3();
    const _lookAt = new THREE.Vector3();
    const _tempColor = new THREE.Color();
    const _fishTop = new THREE.Color();
    const _fishBottom = new THREE.Color();

    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    let uiRect: DOMRect | null = null;
    
    // BOID PARAMETERS
    let SPEED_LIMIT = $derived(mode === 'fish' ? 0.4 : 0.8);
    let VISUAL_RANGE = $derived(mode === 'fish' ? 40 : 50); 
    let PROTECTED_RANGE = $derived(mode === 'fish' ? 10 : 15);
    const BOUNDARY_SIZE = 120;
    
    let SEPARATION_WEIGHT = $derived(mode === 'fish' ? 4.0 : 3.0); 
    let ALIGNMENT_WEIGHT = $derived(mode === 'fish' ? 3.0 : 4.5); 
    let COHESION_WEIGHT = $derived(mode === 'fish' ? 0.8 : 0.4); 
    const MOUSE_REPULSION_WEIGHT = 8.0;

    const bgVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.999, 1.0);
        }
    `;

    const bgFragmentShader = `
        uniform float time;
        varying vec2 vUv;

        float hash31(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n000 = hash31(i + vec3(0,0,0));
            float n100 = hash31(i + vec3(1,0,0));
            float n010 = hash31(i + vec3(0,1,0));
            float n110 = hash31(i + vec3(1,1,0));
            float n001 = hash31(i + vec3(0,0,1));
            float n101 = hash31(i + vec3(1,0,1));
            float n011 = hash31(i + vec3(0,1,1));
            float n111 = hash31(i + vec3(1,1,1));
            float nx00 = mix(n000, n100, f.x);
            float nx10 = mix(n010, n110, f.x);
            float nx01 = mix(n001, n101, f.x);
            float nx11 = mix(n011, n111, f.x);
            float nxy0 = mix(nx00, nx10, f.y);
            float nxy1 = mix(nx01, nx11, f.y);
            return mix(nxy0, nxy1, f.z);
        }
        float fbm3(vec3 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
                v += a * noise3(p);
                p *= 2.0;
                a *= 0.5;
            }
            return v;
        }
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
            vec2 uv = vUv;
            
            // 1. SKY CALCULATIONS
            vec3 zenithColor = vec3(0.12, 0.24, 0.52); // Richer blue top, less black
            vec3 horizonColor = vec3(0.4, 0.6, 0.82); // Lighter blue bottom
            vec3 skyResult = mix(horizonColor, zenithColor, pow(uv.y, 0.78));
            float hazeBand = smoothstep(0.06, 0.2, uv.y) * (1.0 - smoothstep(0.2, 0.38, uv.y));
            skyResult = mix(skyResult, vec3(0.38, 0.58, 0.82), hazeBand * 0.25);

            // Birds-only scene
            vec3 finalColor = skyResult;

            // Soft vignette for depth and focus
            // Vignette removed for a clean scene
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function init() {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x7aa6d6, 0.0020);
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.z = 180;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Unified Background Mesh
        const bgGeo = new THREE.PlaneGeometry(2, 2);
        bgMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { 
                time: { value: 0 }
            },
            vertexShader: bgVertexShader, 
            fragmentShader: bgFragmentShader, 
            depthWrite: false
        }));
        bgMesh.renderOrder = -1;
        scene.add(bgMesh);

        birdGeo = new THREE.ConeGeometry(0.6, 2.5, 4);
        birdGeo.rotateX(Math.PI / 2);

        const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff), transparent: true, opacity: 0.95, vertexColors: true });
        mesh = new THREE.InstancedMesh(birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boidCount * 3), 3);
        scene.add(mesh);
        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);
        scales = new Float32Array(boidCount);

        const baseColor = new THREE.Color(color);
        const tempColor = new THREE.Color();
        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*BOUNDARY_SIZE*2, (Math.random()-0.5)*BOUNDARY_SIZE*2, (Math.random()-0.5)*BOUNDARY_SIZE);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize().multiplyScalar(SPEED_LIMIT);
            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            const scale = 0.85 + Math.random() * 0.45;
            scales[i] = scale;
            _dummy.position.copy(_position);
            _dummy.scale.set(scale, scale, scale);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);

            if (mode === 'fish' && mesh.instanceColor) {
                const depthT = Math.max(0, Math.min(1, (_position.y + BOUNDARY_SIZE) / (BOUNDARY_SIZE * 2)));
                _tempColor.copy(_fishBottom).lerp(_fishTop, depthT);
                mesh.setColorAt(i, _tempColor);
            } else {
                tempColor.copy(baseColor).multiplyScalar(0.85 + Math.random() * 0.25);
                mesh.setColorAt(i, tempColor);
            }
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }


    $effect(() => {
        const isFish = mode === 'fish';
        const currentColor = color;

        if (mesh && bgMesh && birdGeo && fishGeo) {
            // Update Uniform (immediate visual switch)
            const bgMat = bgMesh.material as THREE.ShaderMaterial;
            bgMat.uniforms.isFish.value = isFish ? 1.0 : 0.0;
            bgMat.uniforms.isGrass.value = (mode === 'grass') ? 1.0 : 0.0;

            // Update Bubble Visibility
            if (bubbleParticles) bubbleParticles.visible = isFish;

            // Toggle grass vs boids
            if (grassMesh) grassMesh.visible = (mode === 'grass');
            if (mesh) mesh.visible = (mode !== 'grass');

            // Update Boid Shape
            mesh.geometry = isFish ? fishGeo : birdGeo;

            // Update Fog to match scene
            if (scene && scene.fog) {
                (scene.fog as THREE.FogExp2).color.set(
                    mode === 'fish' ? 0x0b2a3a : mode === 'grass' ? 0x1a251b : 0x7aa6d6
                );
                (scene.fog as THREE.FogExp2).density = mode === 'fish' ? 0.0028 : mode === 'grass' ? 0.0045 : 0.0020;
            }

            if (camera) {
                if (mode === 'grass') {
                    camera.position.set(0, 70, 110);
                    camera.lookAt(0, -30, 0);
                } else {
                    camera.position.set(0, 0, 180);
                    camera.lookAt(0, 0, 0);
                }
            }

            // Update Boid Color
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.set(isFish ? '#ffffff' : currentColor);
            material.opacity = isFish ? 0.95 : 0.85;

            if (isFish) {
                _fishTop.set('#f2fbff'); // bright silver highlight
                _fishBottom.set('#6f8698'); // mid silver-blue shadow
                for (let i = 0; i < boidCount; i++) {
                    const idx = i * 3;
                    const y = positions ? positions[idx + 1] : 0;
                    const depthT = Math.max(0, Math.min(1, (y + BOUNDARY_SIZE) / (BOUNDARY_SIZE * 2)));
                    _tempColor.copy(_fishBottom).lerp(_fishTop, depthT);
                    const s = scales ? scales[i] : 1;
                    _tempColor.multiplyScalar(1.0 + s * 0.35);
                    mesh.setColorAt(i, _tempColor);
                }
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            } else {
                const baseColor = new THREE.Color(currentColor);
                const tempColor = new THREE.Color();
                for (let i = 0; i < boidCount; i++) {
                    const s = scales ? scales[i] : 1;
                    tempColor.copy(baseColor).multiplyScalar(0.78 + s * 0.45);
                    mesh.setColorAt(i, tempColor);
                }
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
        }
    });

    const RUSH_INTERVAL = 5 * 60 * 1000;
    const INITIAL_RUSH_DELAY = 30 * 1000;
    let lastRushAt = performance.now() - (RUSH_INTERVAL - INITIAL_RUSH_DELAY);
    let rushStartAt = 0;

    function animate() {
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; }

        const t = now * 0.001;
        if (bgMesh) {
            const material = bgMesh.material as THREE.ShaderMaterial;
            material.uniforms.time.value = t;
        }

        if (mode === 'grass' && grassMesh) {
            const mx = target.x * 0.2;
            const my = target.y * 0.2;
            const influenceRadius = 70;
            const wind = Math.sin(t * 0.7) * 0.25;
            for (let i = 0; i < grassMesh.count; i++) {
                const x = grassPositions[i * 3];
                const y = grassPositions[i * 3 + 1];
                const z = grassPositions[i * 3 + 2];
                const dx = x - mx;
                const dz = z - my;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const sway = Math.sin(t * 2.2 + grassPhase[i]) * 0.25 + wind;
                const push = dist < influenceRadius ? (1.0 - dist / influenceRadius) * 0.7 : 0.0;
                _dummy.position.set(x, y, z);
                _dummy.rotation.set(0, Math.atan2(dz, dx), 0);
                _dummy.rotateZ(sway + push);
                _dummy.updateMatrix();
                grassMesh.setMatrixAt(i, _dummy.matrix);
            }
            grassMesh.instanceMatrix.needsUpdate = true;
        }


        if (mode === 'fish' && bubbleParticles) {
            const attr = bubbleParticles.geometry.attributes.position as THREE.BufferAttribute;
            for(let i=0; i<attr.count; i++) {
                let y = attr.getY(i) + 0.6; if (y > 400) y = -400; attr.setY(i, y);
                attr.setX(i, attr.getX(i) + Math.sin(now * 0.001 + i) * 0.2);
            }
            attr.needsUpdate = true;
        }

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);

        if (now - lastRushAt > RUSH_INTERVAL && rushStartAt === 0) {
            rushStartAt = now;
        }
        const rushDuration = 8000;
        let rushStrength = 0;
        if (rushStartAt > 0) {
            const tRush = (now - rushStartAt) / rushDuration;
            if (tRush >= 1) {
                rushStartAt = 0;
                lastRushAt = now;
            } else {
                const eased = tRush < 0.5 ? (tRush * 2.0) : (2.0 - tRush * 2.0);
                rushStrength = eased * 0.8;
            }
        }

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

            // Gentle global flow field to add realism
            const flowX = Math.sin(_position.y * 0.02 + t * 0.8) * 0.006;
            const flowY = Math.cos(_position.x * 0.015 + t * 0.6) * 0.006;
            const flowZ = Math.sin(_position.x * 0.01 + _position.y * 0.01 + t * 0.4) * 0.004;
            _acceleration.add(_diff.set(flowX, flowY, flowZ));

            // Occasional camera rush to feel "inside the school"
            if (rushStrength > 0 && (i % 5 === 0)) {
                _acceleration.add(_diff.set(0, 0, 1).multiplyScalar(rushStrength * 0.02));
            }

            // UI avoidance: steer away from the main panel in screen space
            if (uiRect) {
                _diff.copy(_position).project(camera);
                const sx = (_diff.x * 0.5 + 0.5) * window.innerWidth;
                const sy = (-_diff.y * 0.5 + 0.5) * window.innerHeight;
                if (sx > uiRect.left && sx < uiRect.right && sy > uiRect.top && sy < uiRect.bottom) {
                    const cx = (uiRect.left + uiRect.right) * 0.5;
                    const cy = (uiRect.top + uiRect.bottom) * 0.5;
                    const dx = sx - cx;
                    const dy = sy - cy;
                    const len = Math.hypot(dx, dy) || 1;
                    _acceleration.add(_diff.set(dx / len, -dy / len, 0).multiplyScalar(0.04));
                }
            }

            const lim = BOUNDARY_SIZE * 1.2;
            if (Math.abs(_position.x) > lim) _acceleration.x -= Math.sign(_position.x) * 0.05;
            if (Math.abs(_position.y) > lim) _acceleration.y -= Math.sign(_position.y) * 0.05;
            if (Math.abs(_position.z) > lim) _acceleration.z -= Math.sign(_position.z) * 0.05;

            _acceleration.clampLength(0, 0.04);
            _velocity.add(_acceleration).clampLength(0.2, SPEED_LIMIT);
            _position.add(_velocity);

            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;

            if (mode === 'fish' && mesh.instanceColor) {
                const depthT = Math.max(0, Math.min(1, (_position.y + BOUNDARY_SIZE) / (BOUNDARY_SIZE * 2)));
                _tempColor.copy(_fishBottom).lerp(_fishTop, depthT);
                const s = scales ? scales[i] : 1;
                _tempColor.multiplyScalar(0.85 + s * 0.25);
                mesh.setColorAt(i, _tempColor);
            }

            _dummy.position.copy(_position);
            if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
            if (mode === 'bird') {
                const bank = Math.max(-0.6, Math.min(0.6, -_velocity.x * 1.2));
                _dummy.rotateZ(bank);
            }
            const scale = scales ? scales[i] : 1;
            _dummy.scale.set(scale, scale, scale);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mode === 'fish' && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        renderer.render(scene, camera);
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMount(() => {
        init(); animate();
        const updateUIRect = () => {
            const ui = document.querySelector('main') as HTMLElement | null;
            uiRect = ui ? ui.getBoundingClientRect() : null;
        };
        updateUIRect();
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('resize', updateUIRect);
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
