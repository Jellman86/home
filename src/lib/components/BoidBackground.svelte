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
    let mainMaterial: THREE.MeshPhongMaterial; 
    let ambientLight: THREE.AmbientLight;
    let pointLight: THREE.PointLight;
    let dirLight: THREE.DirectionalLight;
    
    let trailGeo: THREE.BufferGeometry;
    let trailHistory: Float32Array;
    let predTrailGeo: THREE.BufferGeometry;
    let predTrailPositions: Float32Array;
    const TRAIL_LENGTH = 15;
    const PRED_TRAIL_LENGTH = 30; 

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
    const NEIGHBOR_COUNT = 7; 
    const TARGET_SPEED = 0.83;
    const SPEED_FORCE = 0.025;
    const PREDATOR_RADIUS = 55;
    const PREDATOR_SPEED = 1.08; 
    const PREDATOR_MIN_SPEED = 0.9;
    const PREDATOR_MAX_STEER = 0.04;
    const PREDATOR_KILL_RADIUS = 4.5;
    const PREDATOR_PREDICT_T = 18;
    
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
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
            vec2 uv = vUv;
            float sun = clamp(sin(dayPhase * 6.28318) * 0.5 + 0.5, 0.0, 1.0);
            vec3 nightZenith = vec3(0.01, 0.02, 0.08);
            vec3 nightHorizon = vec3(0.02, 0.04, 0.1);
            vec3 dayZenith = vec3(0.12, 0.32, 0.75);
            vec3 dayHorizon = vec3(0.3, 0.55, 0.85);
            vec3 zenithColor = mix(nightZenith, dayZenith, pow(sun, 1.2));
            vec3 horizonColor = mix(nightHorizon, dayHorizon, pow(sun, 1.1));
            vec3 skyResult = mix(horizonColor, zenithColor, pow(uv.y, 0.85));
            skyResult *= (1.0 - tension * 0.75);
            float night = 1.0 - sun;
            float starNoise = hash(uv * vec2(1800.0, 1000.0));
            float stars = step(0.997, starNoise) * night;
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

        // --- ENHANCED LIGHTING ---
        ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        pointLight = new THREE.PointLight(0xffffff, 2.5, 600);
        pointLight.position.set(0, 50, 120);
        scene.add(pointLight);

        dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.copy(camera.position);
        scene.add(dirLight);

        const bgGeo = new THREE.PlaneGeometry(2, 2);
        bgMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, dayPhase: { value: 0.25 }, tension: { value: 0 } },
            vertexShader: bgVertexShader, fragmentShader: bgFragmentShader, depthWrite: false
        }));
        bgMesh.renderOrder = -1;
        if (useSkybox) scene.add(bgMesh);

        birdGeo = new THREE.ConeGeometry(0.6, 2.5, 4);
        birdGeo.rotateX(Math.PI / 2);

        const material = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, transparent: true, opacity: 0.95, vertexColors: true, shininess: 50
        });
        mesh = new THREE.InstancedMesh(birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boidCount * 3), 3);
        scene.add(mesh);

        const predatorGeo = new THREE.ConeGeometry(2.2, 7.5, 6);
        predatorGeo.rotateX(Math.PI / 2);
        const predatorMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80 });
        predator = new THREE.Mesh(predatorGeo, predatorMat);
        predator.visible = false;
        scene.add(predator);

        predTrailPositions = new Float32Array(PRED_TRAIL_LENGTH * 3);
        predTrailGeo = new THREE.BufferGeometry();
        predTrailGeo.setAttribute('position', new THREE.BufferAttribute(predTrailPositions, 3));
        const predTrailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        predTrailLine = new THREE.Line(predTrailGeo, predTrailMat);
        predTrailLine.visible = showTrails;
        scene.add(predTrailLine);

        _predPos.set(0, 0, 0);
        _predVel.set(0.6, 0.1, -0.4).setLength(PREDATOR_SPEED);
        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);
        scales = new Float32Array(boidCount);

        const baseColor = new THREE.Color(color);
        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*200, (Math.random()-0.5)*200, 20+Math.random()*100);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), 1).normalize().multiplyScalar(SPEED_LIMIT*2);
            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            scales[i] = 0.75 + Math.random() * 0.55;
            _tempColor.copy(baseColor).multiplyScalar(0.8);
            mesh.setColorAt(i, _tempColor);
            _dummy.position.copy(_position);
            _dummy.scale.set(scales[i], scales[i], scales[i]);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        trailHistory = new Float32Array(boidCount * TRAIL_LENGTH * 3);
        trailGeo = new THREE.BufferGeometry();
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
        trails = new THREE.LineSegments(trailGeo, trailMat);
        trails.visible = showTrails;
        scene.add(trails);
    }

    $effect(() => {
        if (mesh && bgMesh) {
            if (useSkybox) { if (!scene.children.includes(bgMesh)) scene.add(bgMesh); }
            else { if (scene.children.includes(bgMesh)) scene.remove(bgMesh); }
            
            const mat = mesh.material as THREE.MeshPhongMaterial;
            mat.color.set(0xffffff); 
            mat.wireframe = wireframe;
            mat.shininess = isTerminal ? 100 : 30;

            if (ambientLight) ambientLight.intensity = isTerminal ? 0.6 : 0.8;
            if (pointLight) pointLight.intensity = isTerminal ? 4.0 : 1.5;
            
            if (trails) { (trails.material as THREE.LineBasicMaterial).color.set(color); trails.visible = showTrails; }
            if (predator) { (predator.material as THREE.MeshPhongMaterial).color.set(predatorColor); }
            if (predTrailLine) { (predTrailLine.material as THREE.LineBasicMaterial).color.set(predatorColor); predTrailLine.visible = showTrails; }
        }
    });

    const RUSH_INTERVAL = 5 * 60 * 1000;
    const INITIAL_RUSH_DELAY = 30 * 1000;
    let lastRushAt = performance.now() - (RUSH_INTERVAL - INITIAL_RUSH_DELAY);
    let rushStartAt = 0;
    let predTargetIdx = -1;
    let predTargetUntil = 0;
    const predAim = new THREE.Vector3();
    const _baseCol = new THREE.Color();
    const _whiteCol = new THREE.Color(0xffffff);

    function animate() {
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) { fps = frameCount; frameCount = 0; lastTime = now; }
        const t = now * 0.001;
        
        if (bgMesh) {
            const m = bgMesh.material as THREE.ShaderMaterial;
            m.uniforms.time.value = t;
            m.uniforms.dayPhase.value = (t * 0.004 + 0.25) % 1.0;
            m.uniforms.tension.value = recruitmentLevel;
        }

        if (pointLight) {
            if (isTerminal && typingPoint) {
                _diff.set((typingPoint.x/window.innerWidth)*2-1, -(typingPoint.y/window.innerHeight)*2+1, 0.9).unproject(camera);
                pointLight.position.lerp(_diff, 0.1);
            } else {
                pointLight.position.set(mouse.x*100, mouse.y*100, 120);
            }
        }
        if (dirLight) dirLight.position.copy(camera.position);

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);

        const timeSinceInteraction = now - lastInteractionTime;
        const interactionActive = isTerminal && timeSinceInteraction < 60000;
        
        // RECRUITMENT & BOREDOM: Even slower assembly, much faster boredom decay
        if (isTerminal && timeSinceInteraction < 2000) {
            recruitmentLevel = Math.min(1, recruitmentLevel + 0.0003); 
        } else {
            recruitmentLevel = Math.max(0, recruitmentLevel - 0.004); 
        }

        const maxObs = boidCount * 0.20;
        const intFactor = recruitmentLevel * (interactionActive ? Math.pow(Math.max(0, 1 - (timeSinceInteraction / 60000)), 0.5) : 0);
        _baseCol.set(color || '#00ffff');

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);

            const isObserver = intFactor > 0.02 && (i < maxObs * intFactor);

            if (isObserver && uiRect) {
                // STATIONARY OBSERVER
                const angle = (i * 137.5) * (Math.PI / 180); 
                const ring = (i % 6); const margin = 120 + ring * 70; 
                let tsx = (uiRect.left + uiRect.right) * 0.5 + Math.cos(angle) * (uiRect.width * 0.5 + margin);
                let tsy = (uiRect.top + uiRect.bottom) * 0.5 + Math.sin(angle) * (uiRect.height * 0.5 + margin);
                let ndcZ = 0.88 + (ring * 0.015); 
                if (tsx > (uiRect.right - uiRect.width * 0.45)) { ndcZ = 0.96; tsx += 100; }

                _diff.set((tsx / window.innerWidth) * 2 - 1, -(tsy / window.innerHeight) * 2 + 1, ndcZ).unproject(camera);
                _position.lerp(_diff, 0.03); _velocity.set(0, 0, 0); 

                _lookAt.set(((uiRect.left + uiRect.right)*0.5/window.innerWidth)*2-1, -((uiRect.top + uiRect.bottom)*0.5/window.innerHeight)*2+1, 0.5).unproject(camera);
                _dummy.position.copy(_position); _dummy.lookAt(_lookAt);
                
                const pulse = 1.0 + Math.sin(t * (3.0 + recruitmentLevel * 4.0) + i) * (0.1 + recruitmentLevel * 0.2);
                _tempColor.copy(_baseCol);
                if (recruitmentLevel > 0.2) _tempColor.lerp(_whiteCol, Math.min((recruitmentLevel-0.2)*1.5, 0.95));
                _tempColor.multiplyScalar(pulse);
                mesh.setColorAt(i, _tempColor);
                
                const sVar = 0.3 + (Math.sin(i * 0.7) * 0.15); 
                const dScale = 1.0 - (ndcZ - 0.88) * 4.0; 
                _dummy.scale.set(sVar * dScale, sVar * dScale, sVar * dScale);
            } else {
                // FLOCKING PREY
                let alignF = new THREE.Vector3(), cohF = new THREE.Vector3(), sepF = new THREE.Vector3();
                let aC = 0, cC = 0, sC = 0;
                for (let j = 0; j < boidCount; j++) {
                    const oIdx = j * 3; if (oIdx === idx) continue;
                    const dx = _position.x - positions[oIdx], dy = _position.y - positions[oIdx + 1], dz = _position.z - positions[oIdx + 2];
                    const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
                    if (dist < PROTECTED_RANGE && dist > 0.01) { sepF.x += dx/dist; sepF.y += dy/dist; sepF.z += dz/dist; sC++; }
                    if (dist < VISUAL_RANGE && dist > 0.01) {
                        cohF.x += positions[oIdx]; cohF.y += positions[oIdx+1]; cohF.z += positions[oIdx+2]; cC++;
                        alignF.x += velocities[oIdx]; alignF.y += velocities[oIdx+1]; alignF.z += velocities[oIdx+2]; aC++;
                    }
                }
                if (sC > 0) _acceleration.add(sepF.divideScalar(sC).normalize().multiplyScalar(SEPARATION_WEIGHT * 0.12));
                if (cC > 0) _acceleration.add(cohF.divideScalar(cC).sub(_position).normalize().multiplyScalar(COHESION_WEIGHT * 0.01));
                if (aC > 0) _acceleration.add(alignF.divideScalar(aC).normalize().sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.06));
                if (_position.distanceToSquared(target) < 4000) _acceleration.add(_diff.copy(_position).sub(target).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.035));
                _acceleration.add(_diff.set(Math.sin(_position.y*0.015+t*0.6)*0.008, Math.cos(_position.x*0.012+t*0.5)*0.008, Math.sin((_position.x+_position.y)*0.01+t*0.4)*0.006));
                const predF = _lookAt.copy(_predPos).add(_predVel.clone().multiplyScalar(PREDATOR_PREDICT_T * 0.3));
                if (_position.distanceTo(predF) < PREDATOR_RADIUS) _acceleration.add(_diff.copy(_position).sub(predF).normalize().multiplyScalar(0.22));
                if (_velocity.length() > 0.0001) _acceleration.add(_diff.copy(_velocity).setLength(TARGET_SPEED).sub(_velocity).multiplyScalar(SPEED_FORCE));
                const lim = BOUNDARY_SIZE * 1.2;
                if (Math.abs(_position.x) > lim) _acceleration.x -= Math.sign(_position.x) * 0.05;
                if (Math.abs(_position.y) > lim) _acceleration.y -= Math.sign(_position.y) * 0.05;
                if (Math.abs(_position.z) > lim) _acceleration.z -= Math.sign(_position.z) * 0.05;
                _acceleration.clampLength(0, 0.05);
                _velocity.add(_acceleration).clampLength(0.05, SPEED_LIMIT * 0.8);
                _position.add(_velocity);
                _dummy.position.copy(_position);
                if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
                _dummy.scale.set(scales[i], scales[i], scales[i]);
                _tempColor.copy(_baseCol).multiplyScalar(0.7 + (scales[i]-0.7)*0.5);
                mesh.setColorAt(i, _tempColor);
            }
            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;
            _dummy.updateMatrix(); mesh.setMatrixAt(i, _dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        if (showTrails && trails && trails.visible) {
            const pa = trailGeo.attributes.position.array as Float32Array;
            for (let i = 0; i < boidCount; i++) {
                const offset = i * TRAIL_LENGTH * 3;
                pa.copyWithin(offset + 3, offset, offset + (TRAIL_LENGTH - 1) * 3);
                pa[offset] = positions[i*3]; pa[offset+1] = positions[i*3+1]; pa[offset+2] = positions[i*3+2];
            }
            trailGeo.attributes.position.needsUpdate = true;
        }

        if (predTargetIdx < 0 || now > predTargetUntil) { predTargetIdx = Math.floor(Math.random() * boidCount); predTargetUntil = now + 5000; }
        const tIdx = predTargetIdx * 3;
        const predict = _lookAt.set(positions[tIdx] + velocities[tIdx] * PREDATOR_PREDICT_T, positions[tIdx+1] + velocities[tIdx+1] * PREDATOR_PREDICT_T, positions[tIdx+2] + velocities[tIdx+2] * PREDATOR_PREDICT_T);
        predAim.lerp(predict, 0.05); 
        const steer = _diff.copy(_predDesiredDir.copy(predAim).sub(_predPos).setLength(PREDATOR_SPEED)).sub(_predVel).clampLength(0, PREDATOR_MAX_STEER);
        const margin = BOUNDARY_SIZE * 0.8;
        if (_predPos.x < -margin) steer.x += 0.08; if (_predPos.x > margin) steer.x -= 0.08;
        if (_predPos.y < -margin) steer.y += 0.08; if (_predPos.y > margin) steer.y -= 0.08;
        _predVel.add(steer).clampLength(PREDATOR_MIN_SPEED, PREDATOR_SPEED);
        _predPos.add(_predVel);
        if (predator) { predator.position.copy(_predPos); predator.lookAt(_lookAt.copy(_predPos).add(_predVel)); }
        if (showTrails && predTrailLine && predTrailLine.visible) {
            const ppa = predTrailGeo.attributes.position.array as Float32Array;
            ppa.copyWithin(3, 0, (PRED_TRAIL_LENGTH - 1) * 3);
            ppa[0] = _predPos.x; ppa[1] = _predPos.y; ppa[2] = _predPos.z;
            predTrailGeo.attributes.position.needsUpdate = true;
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
        const updateUIRect = () => { uiRect = (document.querySelector('main') as HTMLElement | null)?.getBoundingClientRect() || null; };
        updateUIRect();
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('resize', updateUIRect);
        window.addEventListener('mousemove', (e) => { mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1; });
    });

    onDestroy(() => { if (typeof window !== 'undefined') { if (frameId) cancelAnimationFrame(frameId); if (renderer) renderer.dispose(); } });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>