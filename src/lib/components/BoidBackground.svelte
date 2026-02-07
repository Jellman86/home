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
        const data: any = {
            timestamp: new Date().toISOString(),
            buildHash: gitHash,
            userAgent: navigator.userAgent,
            performance: {
                fps,
                avgFrameProcessingTime: avgFrameTime.toFixed(3) + 'ms',
                memory: (performance as any).memory ? {
                    usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + 'MB'
                } : 'N/A'
            },
            boidCount,
            themeColor: color,
            isTerminal,
            recruitmentLevel,
            cameraZ: camera?.position.z,
            uiRect: uiRect ? { width: uiRect.width, height: uiRect.height } : null
        };

        if (mesh) {
            data.instancedMesh = { count: mesh.count, material: mesh.material.type };
        }

        return JSON.stringify(data, null, 2);
    }

    export function runDiagnostics() {
        const report = getDiagnosticsData();
        console.log('--- COMPREHENSIVE BOID DIAGNOSTICS ---');
        console.log(report);
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
    let startupAt = performance.now();

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
    const TARGET_SPEED = 2.2;
    const SPEED_FORCE = 0.1;
    const PREDATOR_SPEED = 3.5; 
    const PREDATOR_MIN_SPEED = 2.0;
    const PREDATOR_MAX_STEER = 0.5;
    const PREDATOR_PREDICT_T = 2;
    const EAT_RADIUS_SQ = 144; 
    
    let SPEED_LIMIT = $derived(3.0);
    let VISUAL_RANGE = $derived(50); 
    let PROTECTED_RANGE = $derived(20);
    let SEPARATION_WEIGHT = $derived(8.0); 
    let ALIGNMENT_WEIGHT = $derived(2.0); 
    let COHESION_WEIGHT = $derived(5.0); 
    const MOUSE_REPULSION_WEIGHT = 20.0;

    const VISUAL_RANGE_SQ = 50 * 50;
    const PROTECTED_RANGE_SQ = 20 * 20;
    const MOUSE_REPULSION_SQ = 8000;

    const bgVertexShader = `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }
    `;

    const bgFragmentShader = `
        uniform float time; uniform float dayPhase; uniform float tension;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
            vec2 uv = vUv;
            float sun = clamp(sin(dayPhase * 6.28318) * 0.5 + 0.5, 0.0, 1.0);
            vec3 nightZenith = vec3(0.01, 0.02, 0.08); vec3 nightHorizon = vec3(0.02, 0.04, 0.1);
            vec3 dayZenith = vec3(0.12, 0.32, 0.75); vec3 dayHorizon = vec3(0.3, 0.55, 0.85);
            vec3 skyResult = mix(mix(nightHorizon, dayHorizon, pow(sun, 1.1)), mix(nightZenith, dayZenith, pow(sun, 1.2)), pow(uv.y, 0.85));
            skyResult *= (1.0 - tension * 0.75);
            float night = 1.0 - sun;
            float stars = step(0.997, hash(uv * vec2(1800.0, 1000.0))) * night;
            skyResult += stars * vec3(1.0, 1.0, 1.2) * (0.6 + night);
            gl_FragColor = vec4(skyResult, 1.0);
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

        const birdGeo = new THREE.ConeGeometry(1.0, 4.0, 4);
        birdGeo.rotateX(Math.PI / 2); birdGeo.computeVertexNormals();
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, emissive: 0x000000 });
        mesh = new THREE.InstancedMesh(birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boidCount * 3), 3);
        mesh.geometry.setAttribute('instanceColor', mesh.instanceColor); 
        scene.add(mesh);

        const predatorGeo = new THREE.ConeGeometry(5.0, 18.0, 6);
        predatorGeo.rotateX(Math.PI / 2); predatorGeo.computeVertexNormals();
        const predatorMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
        predator = new THREE.Mesh(predatorGeo, predatorMat); predator.visible = true; scene.add(predator);

        positions = new Float32Array(boidCount * 3); velocities = new Float32Array(boidCount * 3);
        scales = new Float32Array(boidCount); maxSpeeds = new Float32Array(boidCount); deathTimers = new Float32Array(boidCount);
        
        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*250, (Math.random()-0.5)*250, 20+Math.random()*80);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), 1).normalize().multiplyScalar(SPEED_LIMIT);
            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            scales[i] = 0.8 + Math.random() * 0.8; maxSpeeds[i] = SPEED_LIMIT * (0.8 + Math.random() * 0.5);
            mesh.setColorAt(i, new THREE.Color(color).multiplyScalar(0.8));
            _dummy.position.copy(_position); _dummy.scale.set(scales[i], scales[i], scales[i]); _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        const startIdx = Math.floor(Math.random() * boidCount) * 3;
        _predPos.set(positions[startIdx], positions[startIdx+1], positions[startIdx+2]);
        _predVel.set(velocities[startIdx], velocities[startIdx+1], velocities[startIdx+2]).setLength(PREDATOR_SPEED);

        const trailHistory = new Float32Array(boidCount * TRAIL_LENGTH * 3);
        const trailGeo = new THREE.BufferGeometry();
        for (let i = 0; i < boidCount; i++) {
            for (let t = 0; t < TRAIL_LENGTH; t++) {
                const o = (i * TRAIL_LENGTH + t) * 3;
                trailHistory[o] = positions[i*3]; trailHistory[o+1] = positions[i*3+1]; trailHistory[o+2] = positions[i*3+2];
            }
        }
        const trailIndices = [];
        for (let i = 0; i < boidCount; i++) {
            const offset = i * TRAIL_LENGTH;
            for (let t = 0; t < TRAIL_LENGTH - 1; t++) trailIndices.push(offset + t, offset + t + 1);
        }
        trailGeo.setIndex(trailIndices);
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailHistory, 3));
        const trailMat = new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.4 });
        trails = new THREE.LineSegments(trailGeo, trailMat); trails.visible = showTrails; scene.add(trails);

        const predTrailGeo = new THREE.BufferGeometry();
        predTrailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PRED_TRAIL_LENGTH * 3), 3));
        predTrailLine = new THREE.Line(predTrailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        predTrailLine.visible = showTrails; scene.add(predTrailLine);
    }

    $effect(() => {
        if (!mesh) return;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        mat.color.set(0xffffff); mat.wireframe = wireframe;
        mat.emissive.set(color); mat.emissiveIntensity = isTerminal ? 1.0 : 0.3;
        if (ambientLight) ambientLight.intensity = isTerminal ? 0.8 : 1.0;
        if (pointLight) pointLight.intensity = isTerminal ? 5.0 : 2.0;
        if (dirLight) dirLight.intensity = isTerminal ? 2.0 : 1.5;
        if (useSkybox) { if (bgMesh && !scene.children.includes(bgMesh)) scene.add(bgMesh); }
        else { if (bgMesh && scene.children.includes(bgMesh)) scene.remove(bgMesh); }
        if (trails) { (trails.material as THREE.LineBasicMaterial).color.set(color); trails.visible = showTrails; }
        if (predator) { 
            const pMat = predator.material as THREE.MeshLambertMaterial;
            pMat.color.set(0xffffff); pMat.emissive.set(predatorColor); pMat.emissiveIntensity = 1.0;
            predator.visible = true; 
        }
        if (predTrailLine) { (predTrailLine.material as THREE.LineBasicMaterial).color.set(predatorColor); predTrailLine.visible = showTrails; }
    });

    let predTargetIdx = -1; let predTargetUntil = 0;
    const _baseCol = new THREE.Color(); const _whiteCol = new THREE.Color(0xffffff);
    let frameStartTime = 0; let lastFrameTime = 0; let avgFrameTime = 0;

    function animate() {
        frameStartTime = performance.now();
        frameId = requestAnimationFrame(animate);
        const now = performance.now(); frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; avgFrameTime = lastFrameTime; }
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
        if (dirLight) dirLight.position.set(camera.position.x, camera.position.y, 300);

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);
        const timeSinceInteraction = now - lastInteractionTime;
        const interactionActive = isTerminal && timeSinceInteraction < 60000;
        if (isTerminal && timeSinceInteraction < 2000) { recruitmentLevel = Math.min(1, recruitmentLevel + 0.0005); } 
        else { recruitmentLevel = Math.max(0, recruitmentLevel - 0.008); }

        if (recruitmentLevel > 0) {
            const el = document.getElementById('boid-target');
            if (el) uiRect = el.getBoundingClientRect();
        }

        const maxObs = boidCount * 0.20;
        const intFactor = recruitmentLevel * (interactionActive ? Math.pow(Math.max(0, 1 - (timeSinceInteraction / 60000)), 0.5) : 0);
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
                _tempColor.set(0xff0000).lerp(_whiteCol, Math.sin(t*10)*0.5+0.5);
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
                const gap = 180 + (i % 3) * 60; 

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

                const floatT = t * 0.3 + i * 0.1;
                tx += Math.sin(floatT) * 12; ty += Math.cos(floatT * 0.7) * 12;

                const vHAtDepth = 2 * Math.tan((75 * Math.PI/180)/2) * 80;
                const vWAtDepth = vHAtDepth * (window.innerWidth / window.innerHeight);
                _diff.set( ((tx/window.innerWidth)*2-1) * (vWAtDepth/2), (-(ty/window.innerHeight)*2+1) * (vHAtDepth/2), 100);
                
                _position.lerp(_diff, 0.05); _velocity.set(0, 0, 0); 
                _lookAt.set(((uiRect.left + uiRect.right)*0.5/window.innerWidth)*2-1, -((uiRect.top + uiRect.bottom)*0.5/window.innerHeight)*2+1, 0.5).unproject(camera);
                _dummy.position.copy(_position); _dummy.lookAt(_lookAt);
                
                const pulse = 1.0 + Math.sin(t * 2.0 + i) * (0.05 + recruitmentLevel * 0.1);
                _tempColor.copy(_baseCol);
                if (recruitmentLevel > 0.2) _tempColor.lerp(_whiteCol, Math.min((recruitmentLevel-0.2)*1.5, 0.95));
                mesh.setColorAt(i, _tempColor.multiplyScalar(pulse));
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
                if (dSqP < 3000) { 
                    _newAccel.add(_scratchV1.set(dxP, dyP, dzP).normalize().multiplyScalar(0.8));
                    if (dSqP < EAT_RADIUS_SQ) deathTimers[i] = 1.0; 
                }

                const wOff = t * 0.05 + i * 0.1;
                _newAccel.add(_scratchV1.set(Math.sin(wOff) * 0.005, Math.cos(wOff * 0.8) * 0.005, Math.sin(wOff * 0.4) * 0.003));
                _newAccel.clampLength(0, 0.25);
                _acceleration.lerp(_newAccel, 0.05); // Ultra-smooth low-pass filter
                
                _velocity.add(_acceleration).clampLength(0.1, maxSpeeds[i]);
                
                const turnZ = 0.25;
                if (_position.z < 20) _velocity.z += turnZ;
                if (_position.z > 150) _velocity.z -= turnZ * 2; // Rigid boundary before camera

                _position.add(_velocity);
                _dummy.position.copy(_position);
                if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
                _dummy.scale.set(scales[i], scales[i], scales[i]);
                _tempColor.copy(_baseCol).multiplyScalar(0.7 + (scales[i]-0.8)*0.5);
                mesh.setColorAt(i, _tempColor);
            }
            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;
            _dummy.updateMatrix(); mesh.setMatrixAt(i, _dummy.matrix);
        }
        mesh.instanceColor!.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;

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
        if (showTrails && predTrailLine) {
            const attr = predTrailLine.geometry.getAttribute('position') as THREE.BufferAttribute;
            const h = attr.array as Float32Array;
            h.copyWithin(3, 0, (PRED_TRAIL_LENGTH - 1) * 3);
            h[0] = _predPos.x; h[1] = _predPos.y; h[2] = _predPos.z;
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
        if (predator) { 
            predator.position.copy(_predPos); 
            if (_predVel.lengthSq() > 0.001) predator.lookAt(_lookAt.copy(_predPos).add(_predVel)); 
        }

        renderer.render(scene, camera);
        lastFrameTime = performance.now() - frameStartTime;
    }

    onMount(() => {
        init(); animate();
        window.addEventListener('resize', () => { 
            if (camera && renderer) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
        });
        window.addEventListener('mousemove', (e) => { mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1; });
    });

    onDestroy(() => { if (typeof window !== 'undefined') { if (frameId) cancelAnimationFrame(frameId); if (renderer) renderer.dispose(); if (debugMaterial) debugMaterial.dispose(); } });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>