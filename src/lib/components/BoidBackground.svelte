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
        typingPoint = null
    }: Props = $props();

    const mode: 'bird' = 'bird';

    let container: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    
    let recruitmentLevel = $state(0);
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let mesh: THREE.InstancedMesh;
    let predator: THREE.Mesh;
    let trails: THREE.LineSegments;
    let predTrailLine: THREE.Line;
    let frameId: number;

    let bgMesh: THREE.Mesh;
    let birdGeo: THREE.BufferGeometry;
    let trailGeo: THREE.BufferGeometry;
    let trailHistory: Float32Array;
    let predTrailGeo: THREE.BufferGeometry;
    let predTrailPositions: Float32Array;
    const TRAIL_LENGTH = 15;
    const PRED_TRAIL_LENGTH = 30; // Longer trail for predator

    // Volumetric clouds are now handled in the shader

    let lastTime = performance.now();
    let frameCount = 0;
    let startupAt = performance.now();


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
    const _predPos = new THREE.Vector3();
    const _predVel = new THREE.Vector3();
    const _predDir = new THREE.Vector3();
    const _predDesiredDir = new THREE.Vector3();

    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    let uiRect: DOMRect | null = null;
    
    // BOID PARAMETERS
    let SPEED_LIMIT = $derived(0.8);
    let VISUAL_RANGE = $derived(36); 
    let PROTECTED_RANGE = $derived(9);
    const BOUNDARY_SIZE = 120;
    const NEIGHBOR_COUNT = 7; // Topological neighbors for realism
    const TARGET_SPEED = 0.83;
    const SPEED_FORCE = 0.025;
    const PREDATOR_RADIUS = 55;
    const PREDATOR_SPEED = 1.08; // 30% faster than prey
    const PREDATOR_MIN_SPEED = 0.9;
    const PREDATOR_MAX_STEER = 0.04;
    const PREDATOR_KILL_RADIUS = 4.5;
    const PREDATOR_PREDICT_T = 18;
    const PREDATOR_MAX_TURN = 0.06; // radians per frame
    
    let SEPARATION_WEIGHT = $derived(2.3); 
    let ALIGNMENT_WEIGHT = $derived(4.5); 
    let COHESION_WEIGHT = $derived(0.9); 
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
        uniform float dayPhase;
        uniform float tension;
        varying vec2 vUv;

        float hash31(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        // ... (rest of noise functions)
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
            float sun = clamp(sin(dayPhase * 6.28318) * 0.5 + 0.5, 0.0, 1.0);
            float twilight = smoothstep(0.0, 0.18, sun) * (1.0 - smoothstep(0.22, 0.35, sun));

            vec3 nightZenith = vec3(0.01, 0.02, 0.08);
            vec3 nightHorizon = vec3(0.02, 0.04, 0.1);
            vec3 dayZenith = vec3(0.12, 0.32, 0.75);
            vec3 dayHorizon = vec3(0.3, 0.55, 0.85);
            vec3 warmTwilight = vec3(0.7, 0.4, 0.18);

            vec3 zenithColor = mix(nightZenith, dayZenith, pow(sun, 1.2));
            vec3 horizonColor = mix(nightHorizon, dayHorizon, pow(sun, 1.1));
            horizonColor = mix(horizonColor, warmTwilight, twilight * 0.35);

            vec3 skyResult = mix(horizonColor, zenithColor, pow(uv.y, 0.85));
            
            // PRESSURE EFFECT: Dim the sky as more watch
            skyResult *= (1.0 - tension * 0.75);

            float hazeBand = smoothstep(0.08, 0.2, uv.y) * (1.0 - smoothstep(0.2, 0.38, uv.y));
            skyResult = mix(skyResult, horizonColor, hazeBand * 0.12);

            // Stars (night only) + Milky Way band
            float night = 1.0 - sun;
            vec2 p = uv - vec2(0.5, 0.5);
            float band = smoothstep(0.24, 0.0, abs(p.y + p.x * 0.6));
            float dust = smoothstep(0.06, 0.0, abs(p.y + p.x * 0.6 + 0.02));
            float mwBase = band * night * (1.0 - dust * 0.6);

            float starNoise = hash(uv * vec2(1800.0, 1000.0));
            float bandBoost = mix(0.9975, 0.991, band);
            float stars = step(bandBoost, starNoise) * night;
            skyResult += stars * vec3(1.0, 1.0, 1.2) * (0.6 + night);

            skyResult += mwBase * vec3(0.45, 0.6, 0.9) * 0.35;

            float exposure = mix(0.15, 1.0, pow(sun, 1.4));
            skyResult *= exposure;

            gl_FragColor = vec4(skyResult, 1.0);
        }
    `;

    function init() {
        scene = new THREE.Scene();
        if (useSkybox) {
            scene.fog = new THREE.FogExp2(0x7aa6d6, 0.0020);
        }
        
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.z = 180;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !useSkybox });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Unified Background Mesh
        const bgGeo = new THREE.PlaneGeometry(2, 2);
        bgMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { 
                time: { value: 0 },
                dayPhase: { value: 0.25 },
                tension: { value: 0 }
            },
            vertexShader: bgVertexShader, 
            fragmentShader: bgFragmentShader, 
            depthWrite: false
        }));
        bgMesh.renderOrder = -1;
        
        if (useSkybox) {
            scene.add(bgMesh);
        }

        birdGeo = new THREE.ConeGeometry(0.6, 2.5, 4);
        birdGeo.rotateX(Math.PI / 2);

        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(0xffffff), 
            transparent: true, 
            opacity: 0.95, 
            vertexColors: true,
            wireframe: wireframe 
        });
        mesh = new THREE.InstancedMesh(birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boidCount * 3), 3);
        scene.add(mesh);

        const predatorGeo = new THREE.ConeGeometry(2.2, 7.5, 6);
        predatorGeo.rotateX(Math.PI / 2);
        const predatorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfd8e3), opacity: 0.95, transparent: true });
        predator = new THREE.Mesh(predatorGeo, predatorMat);
        predator.visible = false;
        scene.add(predator);

        // Predator Trail Setup
        predTrailPositions = new Float32Array(PRED_TRAIL_LENGTH * 3);
        predTrailGeo = new THREE.BufferGeometry();
        predTrailGeo.setAttribute('position', new THREE.BufferAttribute(predTrailPositions, 3));
        
        const predTrailMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(predatorColor),
            transparent: true,
            opacity: 0.5
        });
        predTrailLine = new THREE.Line(predTrailGeo, predTrailMat);
        predTrailLine.visible = showTrails;
        scene.add(predTrailLine);

        _predPos.set(0, 0, 0);
        _predVel.set(0.6, 0.1, -0.4).setLength(PREDATOR_SPEED);
        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);
        scales = new Float32Array(boidCount);

        const baseColor = new THREE.Color(color);
        const tempColor = new THREE.Color();
        for (let i = 0; i < boidCount; i++) {
            // Start closer to the camera (Camera is at z=180)
            // Spread X/Y widely so they encompass the view
            const spread = BOUNDARY_SIZE * 1.5;
            _position.set(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                20 + Math.random() * 100 // Start between z=20 and z=120
            );
            
            // Initial velocity: Push towards camera (+Z) to fly past it
            _velocity.set(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                1.0 + Math.random() * 0.5 // Positive Z velocity
            ).normalize().multiplyScalar(SPEED_LIMIT * 2);

            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            const scale = 0.75 + Math.random() * 0.55;
            scales[i] = scale;
            const depthT = Math.max(0, Math.min(1, (_position.z + BOUNDARY_SIZE) / (BOUNDARY_SIZE * 2)));
            const depthShadeInit = 0.7 + depthT * 0.35;
            _tempColor.copy(baseColor).multiplyScalar(depthShadeInit);
            mesh.setColorAt(i, _tempColor);

            _dummy.position.copy(_position);
            _dummy.scale.set(scale, scale, scale);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);

            // color already set above
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        // --- Trail Initialization ---
        trailHistory = new Float32Array(boidCount * TRAIL_LENGTH * 3);
        trailGeo = new THREE.BufferGeometry();
        
        // Populate initial history with starting positions
        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            const startX = positions[idx];
            const startY = positions[idx + 1];
            const startZ = positions[idx + 2];
            for (let t = 0; t < TRAIL_LENGTH; t++) {
                const offset = (i * TRAIL_LENGTH + t) * 3;
                trailHistory[offset] = startX;
                trailHistory[offset + 1] = startY;
                trailHistory[offset + 2] = startZ;
            }
        }

        const trailIndices = [];
        for (let i = 0; i < boidCount; i++) {
            const offset = i * TRAIL_LENGTH;
            for (let t = 0; t < TRAIL_LENGTH - 1; t++) {
                trailIndices.push(offset + t, offset + t + 1);
            }
        }
        trailGeo.setIndex(trailIndices);
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailHistory, 3));
        
        const trailMat = new THREE.LineBasicMaterial({ 
            color: new THREE.Color(color), 
            transparent: true, 
            opacity: 0.4
        });
        trails = new THREE.LineSegments(trailGeo, trailMat);
        trails.visible = showTrails;
        trails.frustumCulled = false;
        scene.add(trails);
        // -----------------------------
    }


    $effect(() => {
        const currentColor = color;

        if (mesh && bgMesh && birdGeo) {
            // Update Skybox Visibility
            if (useSkybox) {
                 if (!scene.children.includes(bgMesh)) scene.add(bgMesh);
                 // Re-add fog if missing?
                 if (!scene.fog) scene.fog = new THREE.FogExp2(0x7aa6d6, 0.0020);
            } else {
                 if (scene.children.includes(bgMesh)) scene.remove(bgMesh);
                 scene.fog = null; // Remove fog for clean look
                 // Force clear to transparent if renderer supports it, but renderer alpha is set at init
                 // We might need to handle this by setting clear color to transparent
                 renderer.setClearColor(0x000000, 0); 
            }

            // Update Boid Shape
            mesh.geometry = birdGeo;

            // Update Fog to match scene - only if active
            if (scene && scene.fog) {
                (scene.fog as THREE.FogExp2).color.set(0x7aa6d6);
                (scene.fog as THREE.FogExp2).density = 0.0020;
            }

            // Update Boid Color
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.set(currentColor);
            material.opacity = 0.85;
            material.wireframe = wireframe;

            // Update Trail Color/Visibility
            if (trails) {
                (trails.material as THREE.LineBasicMaterial).color.set(currentColor);
                trails.visible = showTrails;
            }

            // Update Predator Color
            if (predator) {
                (predator.material as THREE.MeshBasicMaterial).color.set(predatorColor);
            }
            if (predTrailLine) {
                (predTrailLine.material as THREE.LineBasicMaterial).color.set(predatorColor);
                predTrailLine.visible = showTrails;
            }

            const baseColor = new THREE.Color(currentColor);
            const tempColor = new THREE.Color();
            for (let i = 0; i < boidCount; i++) {
                const s = scales ? scales[i] : 1;
                tempColor.copy(baseColor).multiplyScalar(0.78 + s * 0.45);
                mesh.setColorAt(i, tempColor);
            }
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    });

    const RUSH_INTERVAL = 5 * 60 * 1000;
    const INITIAL_RUSH_DELAY = 30 * 1000;
    let lastRushAt = performance.now() - (RUSH_INTERVAL - INITIAL_RUSH_DELAY);
    let rushStartAt = 0;
    let predTargetIdx = -1;
    let predTargetUntil = 0;
    const predAim = new THREE.Vector3();

    function animate() {
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; }

        const t = now * 0.001;
        const warmup = Math.min(1, (now - startupAt) / 2500);
        if (bgMesh) {
            const material = bgMesh.material as THREE.ShaderMaterial;
            material.uniforms.time.value = t;
            material.uniforms.dayPhase.value = (t * 0.004 + 0.25) % 1.0; // start at midday
            material.uniforms.tension.value = recruitmentLevel;
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

        if (predator) predator.visible = true;
        if (predTargetIdx < 0 || predTargetIdx >= boidCount || now > predTargetUntil) {
            predTargetIdx = Math.floor(Math.random() * boidCount);
            predTargetUntil = now + 5000 + Math.random() * 4000;
        }

        // Interaction / Observer Logic
        const timeSinceInteraction = now - lastInteractionTime;
        const interactionActive = isTerminal && timeSinceInteraction < 60000;
        
        // Recruitment Level: Increases while typing, decreases when idle
        if (isTerminal && timeSinceInteraction < 2000) {
            recruitmentLevel = Math.min(1, recruitmentLevel + 0.005); // Takes ~3 seconds of typing to reach 100%
        } else {
            recruitmentLevel = Math.max(0, recruitmentLevel - 0.002);
        }

        // Final observer count factor
        const interactionFactor = recruitmentLevel * (interactionActive ? Math.pow(Math.max(0, 1 - (timeSinceInteraction / 60000)), 0.5) : 0);

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);

            // Determine if this boid is an observer
            const jitter = (Math.sin(i * 0.1) * 0.05);
            const isObserver = interactionFactor > 0.02 && (i / boidCount) < (interactionFactor + jitter);

            if (isObserver && uiRect) {
                // --- STATIONARY OBSERVER LOGIC ---
                const angle = (i / boidCount) * Math.PI * 2;
                const margin = 130;
                const targetSX = (uiRect.left + uiRect.right) * 0.5 + Math.cos(angle) * (uiRect.width * 0.5 + margin);
                const targetSY = (uiRect.top + uiRect.bottom) * 0.5 + Math.sin(angle) * (uiRect.height * 0.5 + margin);

                // Calculate the world position at a fixed Z (135) that corresponds to the screen target
                // We use unproject with NDC coordinates. 
                // Z=0.9 corresponds to roughly 135-145 world units away from the camera at Z=180
                _diff.set(
                    (targetSX / window.innerWidth) * 2 - 1,
                    -(targetSY / window.innerHeight) * 2 + 1,
                    0.925
                ).unproject(camera);

                // Snap/Lerp to station
                _position.lerp(_diff, 0.2);
                _velocity.set(0, 0, 0); // Absolute freeze on velocity

                // Rotate to track typing point
                const lookX = typingPoint ? typingPoint.x : (uiRect.left + uiRect.right) * 0.5;
                const lookY = typingPoint ? typingPoint.y : (uiRect.top + uiRect.bottom) * 0.5;
                _lookAt.set((lookX / window.innerWidth) * 2 - 1, -(lookY / window.innerHeight) * 2 + 1, 0.5).unproject(camera);
                
                _dummy.position.copy(_position);
                _dummy.lookAt(_lookAt);
                
                // Still use the pulse for color (visual only, not movement)
                const pulse = 0.85 + Math.sin(t * 3.0 + i * 0.2) * (0.05 + recruitmentLevel * 0.15);
                _tempColor.copy(new THREE.Color(color)).multiplyScalar(pulse);
                mesh.setColorAt(i, _tempColor);
                
                // NO scale change while looming to remain perfectly still
                const scale = scales ? scales[i] : 1;
                _dummy.scale.set(scale, scale, scale);
            } else {
                // --- STANDARD BOID LOGIC (MOVING) ---
                let alignF = new THREE.Vector3(), cohF = new THREE.Vector3(), sepF = new THREE.Vector3();
                let aC = 0, cC = 0, sC = 0;

                const nearestDist = new Float32Array(NEIGHBOR_COUNT);
                const nearestIdx = new Int32Array(NEIGHBOR_COUNT);
                for (let k = 0; k < NEIGHBOR_COUNT; k++) {
                    nearestDist[k] = Infinity;
                    nearestIdx[k] = -1;
                }

                for (let j = 0; j < boidCount; j++) {
                    const oIdx = j * 3;
                    if (oIdx === idx) continue;
                    const dx = _position.x - positions[oIdx];
                    const dy = _position.y - positions[oIdx + 1];
                    const dz = _position.z - positions[oIdx + 2];
                    const dSq = dx * dx + dy * dy + dz * dz;
                    const dist = Math.sqrt(dSq);

                    if (dist < PROTECTED_RANGE && dist > 0.01) {
                        sepF.x += dx / dist; sepF.y += dy / dist; sepF.z += dz / dist; sC++;
                    }

                    let maxK = 0;
                    for (let k = 1; k < NEIGHBOR_COUNT; k++) {
                        if (nearestDist[k] > nearestDist[maxK]) maxK = k;
                    }
                    if (dist < nearestDist[maxK]) {
                        nearestDist[maxK] = dist;
                        nearestIdx[maxK] = oIdx;
                    }
                }

                for (let k = 0; k < NEIGHBOR_COUNT; k++) {
                    const oIdx = nearestIdx[k];
                    if (oIdx < 0) continue;
                    const dx = _position.x - positions[oIdx];
                    const dy = _position.y - positions[oIdx + 1];
                    const dz = _position.z - positions[oIdx + 2];
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist < VISUAL_RANGE && dist > 0.01) {
                        cohF.x += positions[oIdx]; cohF.y += positions[oIdx + 1]; cohF.z += positions[oIdx + 2]; cC++;
                        alignF.x += velocities[oIdx]; alignF.y += velocities[oIdx + 1]; alignF.z += velocities[oIdx + 2]; aC++;
                    }
                }

                if (sC > 0) _acceleration.add(sepF.divideScalar(sC).normalize().multiplyScalar(SEPARATION_WEIGHT * 0.12));
                if (cC > 0) _acceleration.add(cohF.divideScalar(cC).sub(_position).normalize().multiplyScalar(COHESION_WEIGHT * 0.01));
                if (aC > 0) _acceleration.add(alignF.divideScalar(aC).normalize().sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.06));

                const distM = _position.distanceToSquared(target);
                if (distM < 4000) _acceleration.add(_diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.035));

                const flowX = Math.sin(_position.y * 0.015 + t * 0.6) * 0.008;
                const flowY = Math.cos(_position.x * 0.012 + t * 0.5) * 0.008;
                const flowZ = Math.sin((_position.x + _position.y) * 0.01 + t * 0.4) * 0.006;
                _acceleration.add(_diff.set(flowX, flowY, flowZ));

                const predFuture = _lookAt.copy(_predPos).add(_predVel.clone().multiplyScalar(PREDATOR_PREDICT_T * 0.3));
                const dPred = _position.distanceTo(predFuture);
                if (dPred < PREDATOR_RADIUS) _acceleration.add(_diff.copy(_position).sub(predFuture).normalize().multiplyScalar(0.22));

                const speed = _velocity.length();
                if (speed > 0.0001) {
                    const desired = _diff.copy(_velocity).setLength(TARGET_SPEED);
                    _acceleration.add(desired.sub(_velocity).multiplyScalar(SPEED_FORCE));
                }

                if (rushStrength > 0 && (i % 5 === 0)) _acceleration.add(_diff.set(0, 0, 1).multiplyScalar(rushStrength * 0.02));

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

                _acceleration.clampLength(0, 0.05);
                _velocity.add(_acceleration).clampLength(0.05, SPEED_LIMIT * (0.4 + warmup * 0.6));
                _position.add(_velocity);

                _dummy.position.copy(_position);
                if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));

                if (mode === 'bird') {
                    const bank = Math.max(-0.6, Math.min(0.6, -_velocity.x * 1.2));
                    _dummy.rotateZ(bank);
                }

                const s = scales ? scales[i] : 1;
                _tempColor.copy(new THREE.Color(color)).multiplyScalar(0.78 + s * 0.45);
                mesh.setColorAt(i, _tempColor);
                
                const scale = scales ? scales[i] : 1;
                _dummy.scale.set(scale, scale, scale);
            }

            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;

            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Update Trails
        if (showTrails && trails && trails.visible) {
            const pa = trailGeo.attributes.position.array as Float32Array;
            for (let i = 0; i < boidCount; i++) {
                const idx = i * 3; // Current boid pos index
                const offset = i * TRAIL_LENGTH * 3; // Trail start index for this boid
                
                // Shift history: move elements from [0..N-2] to [1..N-1]
                // We copy the block of size (TRAIL_LENGTH - 1)*3 from `offset` to `offset + 3`
                pa.copyWithin(offset + 3, offset, offset + (TRAIL_LENGTH - 1) * 3);
                
                // Update head
                pa[offset] = positions[idx];
                pa[offset + 1] = positions[idx + 1];
                pa[offset + 2] = positions[idx + 2];
            }
            trailGeo.attributes.position.needsUpdate = true;
        }

        // Predator pursuit update
        if (predTargetIdx >= 0) {
            const tIdx = predTargetIdx * 3;
            const tx = positions[tIdx];
            const ty = positions[tIdx + 1];
            const tz = positions[tIdx + 2];
            const tvx = velocities[tIdx];
            const tvy = velocities[tIdx + 1];
            const tvz = velocities[tIdx + 2];

            // 1. Prediction (Pursuit)
            const predict = _lookAt.set(
                tx + tvx * PREDATOR_PREDICT_T,
                ty + tvy * PREDATOR_PREDICT_T,
                tz + tvz * PREDATOR_PREDICT_T
            );
            
            // Smoothly move the "aim point" to avoid snapping when switching targets
            predAim.lerp(predict, 0.05); 

            // 2. Reynolds Steering (Seek)
            // Desired velocity is towards the aim point at max speed
            const desired = _predDesiredDir.copy(predAim).sub(_predPos).setLength(PREDATOR_SPEED);
            
            // Steering = Desired - Velocity
            const steer = _diff.copy(desired).sub(_predVel);
            
            // Limit steering force (this creates the smooth turning radius)
            steer.clampLength(0, PREDATOR_MAX_STEER);

            // 3. Soft Boundary Avoidance (Steer back instead of bounce)
            const margin = BOUNDARY_SIZE * 0.8;
            const turnStrength = 0.08;
            
            if (_predPos.x < -margin) steer.x += turnStrength;
            if (_predPos.x > margin)  steer.x -= turnStrength;
            if (_predPos.y < -margin) steer.y += turnStrength;
            if (_predPos.y > margin)  steer.y -= turnStrength;
            if (_predPos.z < -margin) steer.z += turnStrength;
            if (_predPos.z > margin)  steer.z -= turnStrength;

            // Apply steering to velocity
            _predVel.add(steer);
            
            // Limit speed
            _predVel.clampLength(PREDATOR_MIN_SPEED, PREDATOR_SPEED);
            
            // Move
            _predPos.add(_predVel);

            if (_predPos.distanceTo(predict) < PREDATOR_KILL_RADIUS) {
                predTargetIdx = Math.floor(Math.random() * boidCount);
            }
        }

        if (predator && predator.visible) {
            predator.position.copy(_predPos);
            predator.lookAt(_lookAt.copy(_predPos).add(_predVel));

            // Update Predator Trail
            if (showTrails && predTrailLine && predTrailLine.visible) {
                const positions = predTrailGeo.attributes.position.array as Float32Array;
                
                // Shift positions back
                // Move [0..N-2] to [1..N-1]? No, usually head is 0. 
                // Let's shift [0..N-2] to [1..N-1] and put new pos at 0.
                positions.copyWithin(3, 0, (PRED_TRAIL_LENGTH - 1) * 3);
                
                positions[0] = _predPos.x;
                positions[1] = _predPos.y;
                positions[2] = _predPos.z;
                
                predTrailGeo.attributes.position.needsUpdate = true;
            }
        }
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
