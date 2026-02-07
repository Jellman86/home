<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';

    interface Props {
        boidCount?: number;
        color?: string;
        backgroundColor?: string;
        useSkybox?: boolean;
        wireframe?: boolean;
        predatorColor?: string;
        showTrails?: boolean;
        fps?: number;
        isTerminal?: boolean;
        lastInteractionTime?: number;
        typingPoint?: {x: number, y: number} | null;
        gitHash?: string;
    }

    let { 
        boidCount = 800, 
        color = '#00ffff',
        backgroundColor = '#0f172a',
        useSkybox = true,
        wireframe = false,
        predatorColor = '#cfd8e3',
        showTrails = false,
        fps = $bindable(0),
        isTerminal = false,
        lastInteractionTime = 0,
        typingPoint = null,
        gitHash = 'unknown'
    }: Props = $props();

    let debugMode = $state(false);

    export function getDiagnosticsData(): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            buildHash: gitHash,
            performance: { fps },
            boidCount,
            recruitmentLevel,
            cameraZ: camera?.position.z
        }, null, 2);
    }

    export function runDiagnostics() {
        console.log('--- BOID DIAGNOSTICS ---');
        console.log(getDiagnosticsData());
        debugMode = !debugMode;
    }

    let container: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    
    let recruitmentLevel = $state(0);
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let mesh: THREE.InstancedMesh;
    let predator = $state<THREE.Mesh | null>(null);
    let trails: THREE.LineSegments;
    let predTrailLine: THREE.Line;
    let frameId: number;
    let debugMaterial: THREE.MeshNormalMaterial | null = null;

    let bgMesh: THREE.Mesh;
    let ambientLight: THREE.AmbientLight;
    let pointLight: THREE.PointLight;
    let dirLight: THREE.DirectionalLight;
    
    const TRAIL_LENGTH = 15;
    const PRED_TRAIL_LENGTH = 30;

    let lastTime = performance.now();
    let frameCount = 0;

    let positions: Float32Array;
    let velocities: Float32Array;
    let scales: Float32Array;
    let maxSpeeds: Float32Array;
    let deathTimers: Float32Array;
    
    const _position = new THREE.Vector3();
    const _velocity = new THREE.Vector3();
    const _acceleration = new THREE.Vector3();
    const _newAccel = new THREE.Vector3();
    const _dummy = new THREE.Object3D();
    const _diff = new THREE.Vector3();
    const _lookAt = new THREE.Vector3();
    const _tempColor = new THREE.Color();
    const _predPos = new THREE.Vector3();
    const _predVel = new THREE.Vector3();

    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    let uiRect: DOMRect | null = null;
    
    const _scratchV1 = new THREE.Vector3();
    const _alignF = new THREE.Vector3();
    const _cohF = new THREE.Vector3();
    const _sepF = new THREE.Vector3();

    // BOID PARAMETERS
    const BOUNDARY_SIZE = 120;
    const TARGET_SPEED = 2.4;
    const PREDATOR_SPEED = 3.8; 
    const PREDATOR_MAX_STEER = 0.6;
    const EAT_RADIUS_SQ = 144; 
    
    let SPEED_LIMIT = $derived(3.2);
    let VISUAL_RANGE_SQ = 50 * 50; 
    let PROTECTED_RANGE_SQ = 20 * 20;
    let SEPARATION_WEIGHT = $derived(10.0); 
    let ALIGNMENT_WEIGHT = $derived(2.0); 
    let COHESION_WEIGHT = $derived(6.0); 
    const MOUSE_REPULSION_SQ = 8000;

    const bgVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`;
    const bgFragmentShader = `
        uniform float time; uniform float dayPhase; uniform float tension;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
            vec2 uv = vUv; float sun = clamp(sin(dayPhase * 6.28318) * 0.5 + 0.5, 0.0, 1.0);
            vec3 sky = mix(mix(vec3(0.02, 0.04, 0.1), vec3(0.3, 0.55, 0.85), pow(sun, 1.1)), mix(vec3(0.01, 0.02, 0.08), vec3(0.12, 0.32, 0.75), pow(sun, 1.2)), pow(uv.y, 0.85));
            float stars = step(0.997, hash(uv * vec2(1800.0, 1000.0))) * (1.0 - sun);
            gl_FragColor = vec4(sky * (1.0 - tension * 0.7) + stars, 1.0);
        }
    `;

    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.z = 180;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        ambientLight = new THREE.AmbientLight(0xffffff, 1.0); scene.add(ambientLight);
        pointLight = new THREE.PointLight(0xffffff, 5.0, 1000); pointLight.position.set(0, 0, 250); scene.add(pointLight);
        dirLight = new THREE.DirectionalLight(0xffffff, 2.0); dirLight.position.set(0, 0, 400); scene.add(dirLight);

        const bgGeo = new THREE.PlaneGeometry(2, 2);
        bgMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, dayPhase: { value: 0.25 }, tension: { value: 0 } },
            vertexShader: bgVertexShader, fragmentShader: bgFragmentShader, depthWrite: false
        }));
        bgMesh.renderOrder = -1; if (useSkybox) scene.add(bgMesh);

        const birdGeo = new THREE.ConeGeometry(1.2, 4.5, 4);
        birdGeo.rotateX(Math.PI / 2); birdGeo.computeVertexNormals();
        mesh = new THREE.InstancedMesh(birdGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }), boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boidCount * 3), 3);
        mesh.geometry.setAttribute('instanceColor', mesh.instanceColor); scene.add(mesh);

        const predatorGeo = new THREE.ConeGeometry(5.0, 18.0, 6);
        predatorGeo.rotateX(Math.PI / 2); predatorGeo.computeVertexNormals();
        predator = new THREE.Mesh(predatorGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }));
        scene.add(predator);

        positions = new Float32Array(boidCount * 3); velocities = new Float32Array(boidCount * 3);
        scales = new Float32Array(boidCount); maxSpeeds = new Float32Array(boidCount); deathTimers = new Float32Array(boidCount);
        
        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*250, (Math.random()-0.5)*250, 20+Math.random()*80);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), 1).normalize().multiplyScalar(SPEED_LIMIT);
            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            scales[i] = 0.8 + Math.random() * 0.8; maxSpeeds[i] = SPEED_LIMIT * (0.8 + Math.random() * 0.5);
            mesh.setColorAt(i, new THREE.Color(color).multiplyScalar(0.8));
        }

        _predPos.set(0, 0, 50); _predVel.set(0, 0, 1).setLength(PREDATOR_SPEED);

        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(boidCount * TRAIL_LENGTH * 3), 3));
        const trailIndices = [];
        for (let i = 0; i < boidCount; i++) {
            const offset = i * TRAIL_LENGTH;
            for (let t = 0; t < TRAIL_LENGTH - 1; t++) trailIndices.push(offset + t, offset + t + 1);
        }
        trailGeo.setIndex(trailIndices);
        trails = new THREE.LineSegments(trailGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.4 }));
        trails.visible = showTrails; scene.add(trails);

        const predTrailGeo = new THREE.BufferGeometry();
        predTrailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PRED_TRAIL_LENGTH * 3), 3));
        predTrailLine = new THREE.Line(predTrailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        predTrailLine.visible = showTrails; scene.add(predTrailLine);
    }

    $effect(() => {
        if (!mesh) return;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        mat.emissive.set(color); mat.emissiveIntensity = isTerminal ? 1.0 : 0.3;
        if (ambientLight) ambientLight.intensity = isTerminal ? 0.8 : 1.0;
        if (pointLight) pointLight.intensity = isTerminal ? 5.0 : 2.0;
        if (trails) (trails.material as THREE.LineBasicMaterial).color.set(color);
    });

    let avgFrameTime = 0;
    function animate() {
        frameStartTime = performance.now(); frameId = requestAnimationFrame(animate);
        const now = performance.now(); frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; }
        const t = now * 0.001;
        
        if (bgMesh) {
            const m = bgMesh.material as THREE.ShaderMaterial;
            m.uniforms.time.value = t; m.uniforms.dayPhase.value = (t * 0.004 + 0.25) % 1.0; m.uniforms.tension.value = recruitmentLevel;
        }

        if (pointLight) {
            if (isTerminal && typingPoint) {
                _diff.set((typingPoint.x/window.innerWidth)*2-1, -(typingPoint.y/window.innerHeight)*2+1, 0.5).unproject(camera);
                pointLight.position.lerp(_diff, 0.1);
            } else { pointLight.position.set(mouse.x*100, mouse.y*100, 250); }
        }

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);
        if (isTerminal && now - lastInteractionTime < 2000) { recruitmentLevel = Math.min(1, recruitmentLevel + 0.0005); } 
        else { recruitmentLevel = Math.max(0, recruitmentLevel - 0.008); }

        if (recruitmentLevel > 0) {
            const el = document.getElementById('boid-target');
            if (el) uiRect = el.getBoundingClientRect();
        }

        const maxObs = boidCount * 0.20;
        const intFactor = recruitmentLevel * (isTerminal && now - lastInteractionTime < 60000 ? 1 : 0);
        _baseCol.set(color);

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _newAccel.set(0, 0, 0);

            if (deathTimers[i] > 0) {
                deathTimers[i] -= 0.025;
                if (deathTimers[i] <= 0) {
                    _position.set((Math.random()-0.5)*350, (Math.random()-0.5)*350, 20+Math.random()*80);
                    _velocity.set((Math.random()-0.5), (Math.random()-0.5), 1).normalize().multiplyScalar(SPEED_LIMIT);
                }
                _tempColor.set(0xff0000).lerp(_whiteCol, Math.sin(t*15)*0.5+0.5);
                mesh.setColorAt(i, _tempColor);
                const s = scales[i] * Math.max(0, deathTimers[i]);
                _dummy.position.copy(_position); _dummy.scale.set(s, s, s); _dummy.updateMatrix();
                mesh.setMatrixAt(i, _dummy.matrix);
                positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
                continue;
            }

            const isObserver = intFactor > 0.02 && (i < maxObs * intFactor);

            if (isObserver && uiRect) {
                const perimeter = 2 * (uiRect.width + uiRect.height);
                const step = perimeter / Math.min(boidCount * 0.2, 60);
                let dOnP = (i * step) % perimeter;
                const gap = 200 + (i % 3) * 60; 

                let tx = 0, ty = 0;
                if (dOnP < uiRect.width) { tx = uiRect.left + dOnP; ty = uiRect.top - gap; }
                else {
                    dOnP -= uiRect.width;
                    if (dOnP < uiRect.height) { tx = uiRect.right + gap; ty = uiRect.top + dOnP; }
                    else {
                        dOnP -= uiRect.height;
                        if (dOnP < uiRect.width) { tx = uiRect.right - dOnP; ty = uiRect.bottom + gap; }
                        else { dOnP -= uiRect.width; tx = uiRect.left - gap; ty = uiRect.bottom - dOnP; }
                    }
                }

                const vHAtDepth = 2 * Math.tan((75 * Math.PI/180)/2) * 100;
                const vWAtDepth = vHAtDepth * (window.innerWidth / window.innerHeight);
                _diff.set( ((tx/window.innerWidth)*2-1) * (vWAtDepth/2) + Math.sin(t*0.5+i)*10, (-(ty/window.innerHeight)*2+1) * (vHAtDepth/2) + Math.cos(t*0.4+i)*10, 100);
                
                _position.lerp(_diff, 0.05); _velocity.set(0, 0, 0); 
                _lookAt.set(((uiRect.left + uiRect.right)*0.5/window.innerWidth)*2-1, -((uiRect.top + uiRect.bottom)*0.5/window.innerHeight)*2+1, 0.5).unproject(camera);
                _dummy.position.copy(_position); _dummy.lookAt(_lookAt);
                mesh.setColorAt(i, _tempColor.copy(new THREE.Color(color)).multiplyScalar(1.0 + Math.sin(t*3+i)*0.1));
                _dummy.scale.set(scales[i], scales[i], scales[i]);
            } else {
                _alignF.set(0, 0, 0); _cohF.set(0, 0, 0); _sepF.set(0, 0, 0);
                let aC = 0, cC = 0, sC = 0;

                for (let j = 0; j < boidCount; j++) {
                    if (i === j || deathTimers[j] > 0) continue;
                    const dx = _position.x - positions[j*3], dy = _position.y - positions[j*3+1], dz = _position.z - positions[j*3+2];
                    const dSq = dx*dx+dy*dy+dz*dz;
                    if (dSq < PROTECTED_RANGE_SQ && dSq > 0.01) { _sepF.x += dx; _sepF.y += dy; _sepF.z += dz; sC++; }
                    if (dSq < VISUAL_RANGE_SQ && dSq > 0.01) {
                        _cohF.x += positions[j*3]; _cohF.y += positions[j*3+1]; _cohF.z += positions[j*3+2]; cC++;
                        _alignF.x += velocities[j*3]; _alignF.y += velocities[j*3+1]; _alignF.z += velocities[j*3+2]; aC++;
                    }
                }

                if (sC > 0 && _sepF.lengthSq() > 0.001) _newAccel.add(_sepF.normalize().multiplyScalar(SEPARATION_WEIGHT * 0.15));
                if (cC > 0) _newAccel.add(_cohF.divideScalar(cC).sub(_position).normalize().multiplyScalar(COHESION_WEIGHT * 0.015));
                if (aC > 0) _newAccel.add(_alignF.divideScalar(aC).normalize().sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.05));

                const dxP = _position.x - _predPos.x, dyP = _position.y - _predPos.y, dzP = _position.z - _predPos.z;
                const dSqP = dxP*dxP + dyP*dyP + dzP*dzP;
                if (dSqP < 3000 && dSqP > 0.001) { 
                    _newAccel.add(_scratchV1.set(dxP, dyP, dzP).normalize().multiplyScalar(1.0));
                    if (dSqP < EAT_RADIUS_SQ) deathTimers[i] = 1.0; 
                }

                _newAccel.add(_scratchV1.set(Math.sin(t*0.05+i)*0.01, Math.cos(t*0.08+i)*0.01, Math.sin(t*0.04+i)*0.008)).clampLength(0, 0.3);
                _acceleration.lerp(_newAccel, 0.05); // Smooth glide
                _velocity.add(_acceleration).clampLength(0.1, maxSpeeds[i]);
                
                if (_position.z < 20) _velocity.z += 0.3;
                if (_position.z > 150) _velocity.z -= 0.6; // Physical barrier before camera

                _position.add(_velocity);
                _dummy.position.copy(_position);
                if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
                _dummy.scale.set(scales[i], scales[i], scales[i]);
                mesh.setColorAt(i, _tempColor.copy(new THREE.Color(color)).multiplyScalar(0.7 + (scales[i]-0.8)*0.5));
            }
            // Final Safety Check
            if (!Number.isFinite(_position.x) || !Number.isFinite(_velocity.x)) {
                _position.set(0,0,50); _velocity.set(0,0,1);
            }
            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;
            _dummy.updateMatrix(); mesh.setMatrixAt(i, _dummy.matrix);
        }
        mesh.instanceColor!.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true;

        if (showTrails && trails) {
            const attr = trails.geometry.getAttribute('position') as THREE.BufferAttribute;
            const h = attr.array as Float32Array;
            for (let i = 0; i < boidCount; i++) {
                if (deathTimers[i] > 0) continue; 
                const bIdx = i * 3; const tOff = i * TRAIL_LENGTH * 3;
                h.copyWithin(tOff + 3, tOff, tOff + (TRAIL_LENGTH - 1) * 3);
                h[tOff] = positions[bIdx]; h[tOff+1] = positions[bIdx+1]; h[tOff+2] = positions[bIdx+2];
            }
            attr.needsUpdate = true;
        }

        if (predTargetIdx < 0 || now > predTargetUntil) { predTargetIdx = Math.floor(Math.random() * boidCount); predTargetUntil = now + 5000; }
        const tIdx = predTargetIdx * 3;
        const predict = _lookAt.set(positions[tIdx] + velocities[tIdx] * PREDATOR_PREDICT_T, positions[tIdx+1] + velocities[tIdx+1] * PREDATOR_PREDICT_T, positions[tIdx+2] + velocities[tIdx+2] * PREDATOR_PREDICT_T);
        _diff.copy(predict).sub(_predPos);
        if (_diff.lengthSq() > 0.001) {
            const steer = _scratchV1.copy(_diff).setLength(PREDATOR_SPEED).sub(_predVel).clampLength(0, PREDATOR_MAX_STEER);
            _predVel.add(steer).clampLength(PREDATOR_MIN_SPEED, PREDATOR_SPEED);
        }
        _predPos.add(_predVel);
        if (predator) { predator.position.copy(_predPos); if (_predVel.lengthSq() > 0.001) predator.lookAt(_lookAt.copy(_predPos).add(_predVel)); }

        renderer.render(scene, camera);
        lastFrameTime = performance.now() - frameStartTime; avgFrameTime = lastFrameTime;
    }

    onMount(() => {
        init(); animate();
        window.addEventListener('resize', () => { if (camera && renderer) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); } });
        window.addEventListener('mousemove', (e) => { mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1; });
    });

    onDestroy(() => { if (typeof window !== 'undefined') { if (frameId) cancelAnimationFrame(frameId); if (renderer) renderer.dispose(); if (debugMaterial) debugMaterial.dispose(); } });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0"><canvas bind:this={canvas} class="w-full h-full block"></canvas></div>