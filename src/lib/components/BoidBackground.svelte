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
        // NOTE: Keep this reasonably cheap; it's called on demand via UI.
        const data: any = {
            timestamp: new Date().toISOString(),
            buildHash: gitHash,
            userAgent: navigator.userAgent,
            performance: {
                fps,
                avgFrameProcessingTime: avgFrameTime.toFixed(3) + 'ms',
                memory: (performance as any).memory ? {
                    usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                    jsHeapSizeLimit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                } : 'Not available (non-Chrome)',
                navigation: performance.getEntriesByType('navigation')[0] || 'N/A'
            },
            boidCount,
            themeColor: color,
            isTerminal,
            recruitmentLevel,
            lastInteractionTime,
            timeSinceInteraction: performance.now() - lastInteractionTime,
            uiRect: uiRect ? {
                top: uiRect.top,
                bottom: uiRect.bottom,
                left: uiRect.left,
                right: uiRect.right,
                width: uiRect.width,
                height: uiRect.height
            } : null,
            renderer: {
                pixelRatio: renderer.getPixelRatio(),
                outputColorSpace: renderer.outputColorSpace,
                toneMapping: renderer.toneMapping,
                capabilities: {
                    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
                    maxPrecision: renderer.capabilities.precision,
                    isWebGL2: renderer.capabilities.isWebGL2
                },
                info: {
                    geometries: renderer.info.memory.geometries,
                    textures: renderer.info.memory.textures,
                    drawCalls: renderer.info.render.calls,
                    triangles: renderer.info.render.triangles
                },
                dimensions: {
                    window: [window.innerWidth, window.innerHeight],
                    canvas: [canvas.width, canvas.height],
                    style: [canvas.clientWidth, canvas.clientHeight]
                }
            },
            scene: {
                fog: scene.fog ? {
                    type: (scene.fog as any).isFogExp2 ? 'FogExp2' : 'Fog',
                    color: (scene.fog as any).color.getHexString(),
                    density: (scene.fog as any).density || null,
                    near: (scene.fog as any).near || null,
                    far: (scene.fog as any).far || null
                } : null,
                backgroundUniforms: bgMesh ? {
                    time: (bgMesh.material as THREE.ShaderMaterial).uniforms.time.value,
                    dayPhase: (bgMesh.material as THREE.ShaderMaterial).uniforms.dayPhase.value,
                    tension: (bgMesh.material as THREE.ShaderMaterial).uniforms.tension.value,
                    pulse: (bgMesh.material as THREE.ShaderMaterial).uniforms.pulse.value
                } : null
            },
            camera: {
                position: camera.position.toArray(),
                rotation: camera.rotation.toArray(),
                zoom: camera.zoom,
                near: camera.near,
                far: camera.far
            }
        };

        // Screen-space samples to debug "boids behind the terminal" reports.
        // This helps validate whether boids are actually projecting into the UI rect.
        try {
            if (uiRect && camera && positions && velocities) {
                const now = performance.now();
                const t = now * 0.001;
                const timeSinceInteraction = now - lastInteractionTime;
                const interactionActive = isTerminal && timeSinceInteraction < 60000;
                const maxObs = boidCount * (isTerminal ? 0.55 : 0.20);
                const intFactor = recruitmentLevel * (interactionActive ? Math.pow(Math.max(0, 1 - (timeSinceInteraction / 60000)), 0.5) : 0);
                const obsLimit = maxObs * intFactor;
                const left = uiRect.left - UI_AVOID_MARGIN_PX;
                const right = uiRect.right + UI_AVOID_MARGIN_PX;
                const top = uiRect.top - UI_AVOID_MARGIN_PX;
                const bottom = uiRect.bottom + UI_AVOID_MARGIN_PX;
                const cx = (uiRect.left + uiRect.right) * 0.5;
                const cy = (uiRect.top + uiRect.bottom) * 0.5;

                const samples: any[] = [];
                const sampleN = Math.min(8, boidCount);
                for (let i = 0; i < sampleN; i++) {
                    const idx = i * 3;
                    const world = { x: positions[idx], y: positions[idx + 1], z: positions[idx + 2] };
                    const ndc = new THREE.Vector3(world.x, world.y, world.z).project(camera);
                    const sx = (ndc.x * 0.5 + 0.5) * window.innerWidth;
                    const sy = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
                    const insideExpanded = sx > left && sx < right && sy > top && sy < bottom;

                    // What observer mode *wants* to do for this i.
                    const isObserver = intFactor > 0.02 && (i < obsLimit);
                    const angle = (i * 137.5) * (Math.PI / 180);
                    const margin = 120 + (i % 4) * 60;
                    const timeOff = t * (0.2 + (i % 5) * 0.05) + i;
                    const tsx = cx + Math.cos(angle) * (uiRect.width * 0.5 + margin) + Math.sin(timeOff) * 15;
                    const tsy = cy + Math.sin(angle) * (uiRect.height * 0.5 + margin) + Math.cos(timeOff) * 15;
                    const targetInside = tsx > left && tsx < right && tsy > top && tsy < bottom;

                    samples.push({
                        i,
                        isObserver,
                        world,
                        ndc: { x: ndc.x, y: ndc.y, z: ndc.z },
                        screen: { x: Math.round(sx * 10) / 10, y: Math.round(sy * 10) / 10 },
                        insideExpanded,
                        observerTarget: { x: Math.round(tsx * 10) / 10, y: Math.round(tsy * 10) / 10, insideExpanded: targetInside },
                        v: { x: velocities[idx], y: velocities[idx + 1], z: velocities[idx + 2] }
                    });
                }

                data.debug = {
                    uiAvoidMarginPx: UI_AVOID_MARGIN_PX,
                    observerLimit: obsLimit,
                    interactionActive,
                    samples
                };
            }
        } catch (e) {
            data.debug = { error: String(e) };
        }

        if (mesh) {
            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const matrixSample: number[][] = [];
            const _tempMatrix = new THREE.Matrix4();
            for (let i = 0; i < Math.min(3, boidCount); i++) {
                mesh.getMatrixAt(i, _tempMatrix);
                matrixSample.push(_tempMatrix.elements.slice());
            }

            data.instancedMesh = {
                visible: mesh.visible,
                frustumCulled: mesh.frustumCulled,
                count: mesh.count,
                instanceMatrixSample: matrixSample,
                matrixWorld: mesh.matrixWorld.elements,
                geometryAttributes: Object.keys(mesh.geometry.attributes),
                material: {
                    type: mat.type,
                    color: (mat as any).color?.getHexString?.(),
                    emissive: (mat as any).emissive?.getHexString?.(),
                    emissiveIntensity: (mat as any).emissiveIntensity,
                    vertexColors: (mat as any).vertexColors,
                    transparent: (mat as any).transparent,
                    opacity: (mat as any).opacity,
                    wireframe: (mat as any).wireframe
                }
            };

            const colorAttr = mesh.geometry.getAttribute('instanceColor');
            if (colorAttr) {
                data.instanceColorBuffer = {
                    count: colorAttr.count,
                    itemSize: colorAttr.itemSize,
                    firstFive: [
                        [colorAttr.getX(0), colorAttr.getY(0), colorAttr.getZ(0)],
                        [colorAttr.getX(1), colorAttr.getY(1), colorAttr.getZ(1)],
                        [colorAttr.getX(2), colorAttr.getY(2), colorAttr.getZ(2)],
                        [colorAttr.getX(3), colorAttr.getY(3), colorAttr.getZ(3)],
                        [colorAttr.getX(4), colorAttr.getY(4), colorAttr.getZ(4)]
                    ]
                };
            }
        }

        const lights: any[] = [];
        scene.traverse(obj => {
            if (obj instanceof THREE.Light) {
                lights.push({
                    type: obj.type,
                    intensity: obj.intensity,
                    color: obj.color.getHexString(),
                    position: obj.position.toArray()
                });
            }
        });
        data.lights = lights;

        return JSON.stringify(data, null, 2);
    }

    export function runDiagnostics() {
        const report = getDiagnosticsData();
        console.log('--- COMPREHENSIVE BOID DIAGNOSTICS ---');
        console.log(report);
        debugMode = !debugMode;
        console.log('Debug Mode Toggled:', debugMode);
        console.log('------------------------');
    }

    let container: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    
    let recruitmentLevel = $state(0);
    let typingDurationSec = 0;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let mesh: THREE.InstancedMesh;
    let predator = $state<THREE.Mesh | null>(null);
    let trails: THREE.LineSegments;
    let predTrailLine: THREE.Line;
    let trailHistory: Float32Array | null = null;
    let predTrailHistory: Float32Array | null = null;
    let frameId: number;
    let debugMaterial: THREE.MeshNormalMaterial | null = null;

    let bgMesh: THREE.Mesh;
    let ambientLight: THREE.AmbientLight;
    let pointLight: THREE.PointLight;
    let dirLight: THREE.DirectionalLight;
    
    const TRAIL_LENGTH = 15;
    const PRED_TRAIL_LENGTH = 30;

    let lastTime = performance.now();
    let simLastTime = performance.now();
    let frameCount = 0;
    let startupAt = performance.now();

    let positions: Float32Array;
    let velocities: Float32Array;
    let positionsNext: Float32Array;
    let velocitiesNext: Float32Array;
    let scales: Float32Array;
    let maxSpeeds: Float32Array;
    let deathTimers: Float32Array;
    let deathTimersNext: Float32Array;
    let orientations: Float32Array;
    
    const _position = new THREE.Vector3();
    const _velocity = new THREE.Vector3();
    const _acceleration = new THREE.Vector3();
    const _dummy = new THREE.Object3D();
    const _diff = new THREE.Vector3();
    const _lookAt = new THREE.Vector3();
    const _tempColor = new THREE.Color();
    const _predPos = new THREE.Vector3();
    const _predVel = new THREE.Vector3();
    const _predDesiredDir = new THREE.Vector3();
    const _quatCurrent = new THREE.Quaternion();
    const _quatTarget = new THREE.Quaternion();
    const _observerTarget = new THREE.Vector2();

    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    let uiRect: DOMRect | null = null;
    let mainElement: HTMLElement | null = null;
    let uiTargetElement: HTMLElement | null = null;
    let lastUIRectUpdateAt = 0;
    let uiWorldBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
    const UI_AVOID_MARGIN_PX = 18;
    const OBSERVER_SCREEN_PADDING_PX = 96; // extra padding so observer geometry doesn't clip into the UI
    const OBSERVER_DISTANCE_FROM_CAMERA = 30; // 50% closer again for stronger looming
    const ORIENTATION_SMOOTHING = 0.24;

    function applyUIAvoidanceForce(extraPaddingPx = 0) {
        // Softly push boids away from UI bounds to avoid hard teleports and jitter.
        if (!isTerminal || !uiRect) return;

        const ndc = _scratchV2.copy(_position).project(camera);
        const sx = (ndc.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-ndc.y * 0.5 + 0.5) * window.innerHeight;

        const pad = UI_AVOID_MARGIN_PX + extraPaddingPx;
        const left = uiRect.left - pad;
        const right = uiRect.right + pad;
        const top = uiRect.top - pad;
        const bottom = uiRect.bottom + pad;

        if (!(sx > left && sx < right && sy > top && sy < bottom)) return;

        const dl = sx - left;
        const dr = right - sx;
        const dt = sy - top;
        const db = bottom - sy;
        const minEdge = Math.min(dl, dr, dt, db);
        const penetration = Math.max(0, 70 - minEdge);

        let tx = sx;
        let ty = sy;
        if (minEdge === dl) tx = left - 32;
        else if (minEdge === dr) tx = right + 32;
        else if (minEdge === dt) ty = top - 32;
        else ty = bottom + 32;

        const tNdcX = (tx / window.innerWidth) * 2 - 1;
        const tNdcY = -((ty / window.innerHeight) * 2 - 1);
        const targetWorld = _scratchV3.set(tNdcX, tNdcY, ndc.z).unproject(camera);
        const strength = Math.min(0.3, 0.04 + (penetration / 1200));
        _velocity.add(targetWorld.sub(_position).multiplyScalar(strength));
        _velocity.multiplyScalar(0.94);
    }

    function computeObserverScreenTarget(i: number, t: number, out = _observerTarget) {
        if (!uiRect) return out.set(0, 0);
        const angle = (i * 137.5) * (Math.PI / 180);
        const margin = 120 + (i % 4) * 60;
        const timeOff = t * (0.08 + (i % 5) * 0.02) + i * 0.35;
        const ringPad = OBSERVER_SCREEN_PADDING_PX + 22;
        let tsx = (uiRect.left + uiRect.right) * 0.5 + Math.cos(angle) * (uiRect.width * 0.5 + margin + ringPad) + Math.sin(timeOff) * 6;
        let tsy = (uiRect.top + uiRect.bottom) * 0.5 + Math.sin(angle) * (uiRect.height * 0.5 + margin + ringPad) + Math.cos(timeOff) * 6;

        if (tsx > uiRect.left - ringPad && tsx < uiRect.right + ringPad && tsy > uiRect.top - ringPad && tsy < uiRect.bottom + ringPad) {
            const dx = tsx - (uiRect.left + uiRect.right) * 0.5;
            const dy = tsy - (uiRect.top + uiRect.bottom) * 0.5;
            if (Math.abs(dx) > Math.abs(dy)) tsx = dx > 0 ? uiRect.right + ringPad + 28 : uiRect.left - ringPad - 28;
            else tsy = dy > 0 ? uiRect.bottom + ringPad + 28 : uiRect.top - ringPad - 28;
        }

        return out.set(tsx, tsy);
    }

    function screenToWorldAtDistance(screenX: number, screenY: number, distanceFromCamera: number, out = _scratchV3) {
        const nx = (screenX / window.innerWidth) * 2 - 1;
        const ny = -(screenY / window.innerHeight) * 2 + 1;
        out.set(nx, ny, 0.5).unproject(camera);
        return out
            .sub(camera.position)
            .normalize()
            .multiplyScalar(distanceFromCamera)
            .add(camera.position);
    }

    // PERFORMANCE: Spatial Partitioning & Scratch Vectors
    const GRID_SIZE = 40;
    let gridHeaders: Int32Array;
    let boidNext: Int32Array;
    let gridCellsCount = 0;
    const _scratchV1 = new THREE.Vector3();
    const _scratchV2 = new THREE.Vector3();
    const _scratchV3 = new THREE.Vector3();
    const _alignF = new THREE.Vector3();
    const _cohF = new THREE.Vector3();
    const _sepF = new THREE.Vector3();

    // BOID PARAMETERS
    const BOUNDARY_SIZE = 120;
    const NEIGHBOR_COUNT = 7; 
    const TARGET_SPEED = 1.3;
    const SPEED_FORCE = 0.04;
    const PREDATOR_RADIUS = 55;
    const PREDATOR_SPEED = 2.4; 
    const PREDATOR_MIN_SPEED = 1.3;
    const PREDATOR_MAX_STEER = 0.25;
    const PREDATOR_PREDICT_T = 4;
    const EAT_RADIUS_SQ = 49; // ~7 world units
    
    let SPEED_LIMIT = $derived(1.6);
    let VISUAL_RANGE = $derived(45); 
    let PROTECTED_RANGE = $derived(12);
    let SEPARATION_WEIGHT = $derived(5.5); 
    let ALIGNMENT_WEIGHT = $derived(2.5); 
    let COHESION_WEIGHT = $derived(3.5); 
    const MOUSE_REPULSION_WEIGHT = 15.0;
    const OBSERVER_MAX_SPEED = 1.1;
    const OBSERVER_MAX_STEER = 0.09;
    const OBSERVER_SEPARATION_SQ = 20 * 20;
    const MAX_FRAME_DELTA_SEC = 1 / 20;
    const MAX_SIM_STEP_SEC = 1 / 75;
    const MAX_SIM_SUBSTEPS = 4;

    const VISUAL_RANGE_SQ = 45 * 45;
    const PROTECTED_RANGE_SQ = 12 * 12;
    const MOUSE_REPULSION_SQ = 6000;
    const GRID_EXTENT = BOUNDARY_SIZE * 1.25;
    const GRID_SPAN = GRID_EXTENT * 2;
    const neighborIdx = new Int32Array(NEIGHBOR_COUNT);
    const neighborDistSq = new Float32Array(NEIGHBOR_COUNT);

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
        uniform float pulse;
        varying vec2 vUv;
        float hash31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
            vec2 uv = vUv;
            float sun = clamp(sin(dayPhase * 6.28318) * 0.5 + 0.5, 0.0, 1.0);
            vec3 nightZenith = vec3(0.01, 0.02, 0.08);
            vec3 nightHorizon = vec3(0.02, 0.04, 0.1);
            vec3 dayZenith = vec3(0.12, 0.32, 0.75);
            vec3 dayHorizon = vec3(0.3, 0.55, 0.85);
            vec3 skyResult = mix(mix(nightHorizon, dayHorizon, pow(sun, 1.1)), mix(nightZenith, dayZenith, pow(sun, 1.2)), pow(uv.y, 0.85));
            skyResult *= (1.0 - tension * 0.75);
            float night = 1.0 - sun;
            float starNoise = hash(uv * vec2(1800.0, 1000.0));
            float stars = step(0.997, starNoise) * night;
            skyResult += stars * vec3(1.0, 1.0, 1.2) * (0.6 + night);
            float radial = 1.0 - clamp(length(uv - vec2(0.5)) * 1.6, 0.0, 1.0);
            skyResult += vec3(0.22, 0.08, 0.04) * pulse * radial * 0.35;
            skyResult *= 1.0 + pulse * (0.04 + radial * 0.08);
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

        // LIGHTS
        ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
        scene.add(ambientLight);
        pointLight = new THREE.PointLight(0xffffff, 5.0, 1000);
        pointLight.position.set(0, 0, 250); 
        scene.add(pointLight);
        dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(0, 0, 400);
        scene.add(dirLight);

        // BG
        const bgGeo = new THREE.PlaneGeometry(2, 2);
        bgMesh = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, dayPhase: { value: 0.25 }, tension: { value: 0 }, pulse: { value: 0 } },
            vertexShader: bgVertexShader, fragmentShader: bgFragmentShader, depthWrite: false
        }));
        bgMesh.renderOrder = -1;
        if (useSkybox) scene.add(bgMesh);

        // BOIDS
        const birdGeo = new THREE.ConeGeometry(0.6, 2.5, 4);
        birdGeo.rotateX(Math.PI / 2);
        birdGeo.computeVertexNormals();
        
        const material = new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95, 
            emissive: 0x000000
        });
        mesh = new THREE.InstancedMesh(birdGeo, material, boidCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boidCount * 3), 3);
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.geometry.setAttribute('instanceColor', mesh.instanceColor); 
        scene.add(mesh);

        // PREDATOR
        const predatorGeo = new THREE.ConeGeometry(3.5, 12.0, 6);
        predatorGeo.rotateX(Math.PI / 2);
        predatorGeo.computeVertexNormals();
        const predatorMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
        predator = new THREE.Mesh(predatorGeo, predatorMat);
        predator.visible = true;
        scene.add(predator);

        // DATA
        positions = new Float32Array(boidCount * 3);
        velocities = new Float32Array(boidCount * 3);
        positionsNext = new Float32Array(boidCount * 3);
        velocitiesNext = new Float32Array(boidCount * 3);
        scales = new Float32Array(boidCount);
        maxSpeeds = new Float32Array(boidCount);
        deathTimers = new Float32Array(boidCount);
        deathTimersNext = new Float32Array(boidCount);
        orientations = new Float32Array(boidCount * 4);
        
        // Grid Initialization
        gridCellsCount = Math.ceil((BOUNDARY_SIZE * 2.5) / GRID_SIZE);
        const totalCells = gridCellsCount * gridCellsCount * gridCellsCount;
        gridHeaders = new Int32Array(totalCells);
        boidNext = new Int32Array(boidCount);
        mainElement = document.querySelector('main');
        uiTargetElement = (document.getElementById('boid-target') as HTMLElement | null) ?? mainElement;

        const baseColor = new THREE.Color(color);
        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*250, (Math.random()-0.5)*250, 20+Math.random()*100);
            _velocity.set((Math.random()-0.5), (Math.random()-0.5), 1).normalize().multiplyScalar(SPEED_LIMIT*2);
            positions[i*3]=_position.x; positions[i*3+1]=_position.y; positions[i*3+2]=_position.z;
            velocities[i*3]=_velocity.x; velocities[i*3+1]=_velocity.y; velocities[i*3+2]=_velocity.z;
            scales[i] = 0.75 + Math.random() * 0.55;
            maxSpeeds[i] = SPEED_LIMIT * (0.85 + Math.random() * 0.4);
            _tempColor.copy(baseColor).multiplyScalar(0.8);
            mesh.setColorAt(i, _tempColor);
            _dummy.position.copy(_position);
            _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
            _dummy.scale.set(scales[i], scales[i], scales[i]);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
            const qIdx = i * 4;
            orientations[qIdx] = _dummy.quaternion.x;
            orientations[qIdx + 1] = _dummy.quaternion.y;
            orientations[qIdx + 2] = _dummy.quaternion.z;
            orientations[qIdx + 3] = _dummy.quaternion.w;
        }
        positionsNext.set(positions);
        velocitiesNext.set(velocities);
        deathTimersNext.set(deathTimers);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Initialize predator near a random boid
        const startIdx = Math.floor(Math.random() * boidCount) * 3;
        _predPos.set(positions[startIdx], positions[startIdx+1], positions[startIdx+2]);
        _predVel.set(velocities[startIdx], velocities[startIdx+1], velocities[startIdx+2]).setLength(PREDATOR_SPEED);

        // TRAILS
        trailHistory = new Float32Array(boidCount * TRAIL_LENGTH * 3);
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
        trails = new THREE.LineSegments(trailGeo, trailMat);
        trails.visible = showTrails;
        scene.add(trails);

        const predTrailGeo = new THREE.BufferGeometry();
        predTrailHistory = new Float32Array(PRED_TRAIL_LENGTH * 3);
        predTrailGeo.setAttribute('position', new THREE.BufferAttribute(predTrailHistory, 3));
        predTrailLine = new THREE.Line(predTrailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        predTrailLine.visible = showTrails;
        scene.add(predTrailLine);
    }

    function resetTrailHistory() {
        if (!trailHistory || !trails) return;
        // Reset all trail segments to the current boid positions so disabling/enabling doesn't leave "ghost" streaks.
        for (let i = 0; i < boidCount; i++) {
            const b = i * 3;
            const x = positions[b];
            const y = positions[b + 1];
            const z = positions[b + 2];
            const tOff = i * TRAIL_LENGTH * 3;
            for (let t = 0; t < TRAIL_LENGTH; t++) {
                const o = tOff + t * 3;
                trailHistory[o] = x;
                trailHistory[o + 1] = y;
                trailHistory[o + 2] = z;
            }
        }
        (trails.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    function resetPredTrailHistory() {
        if (!predTrailHistory || !predTrailLine) return;
        for (let t = 0; t < PRED_TRAIL_LENGTH; t++) {
            const o = t * 3;
            predTrailHistory[o] = _predPos.x;
            predTrailHistory[o + 1] = _predPos.y;
            predTrailHistory[o + 2] = _predPos.z;
        }
        (predTrailLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    function updateUIBounds(now: number) {
        // Layout reads are expensive; throttle.
        if (!uiTargetElement || now - lastUIRectUpdateAt < 200) return;
        lastUIRectUpdateAt = now;

        uiRect = uiTargetElement.getBoundingClientRect();
        if (!camera) return;

        // Convert UI rect corners to approximate world XY bounds at a stable depth.
        const z = 0.2;
        const p1 = _scratchV1.set((uiRect.left / window.innerWidth) * 2 - 1, -(uiRect.top / window.innerHeight) * 2 + 1, z).unproject(camera);
        const p2 = _scratchV2.set((uiRect.right / window.innerWidth) * 2 - 1, -(uiRect.bottom / window.innerHeight) * 2 + 1, z).unproject(camera);
        uiWorldBounds = {
            minX: Math.min(p1.x, p2.x),
            maxX: Math.max(p1.x, p2.x),
            minY: Math.min(p1.y, p2.y),
            maxY: Math.max(p1.y, p2.y),
        };
    }

    $effect(() => {
        if (!mesh) return;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        mat.color.set(0xffffff); 
        mat.wireframe = wireframe;
        mat.emissive.set(color);
        mat.emissiveIntensity = isTerminal ? 1.0 : 0.3;
        
        if (ambientLight) ambientLight.intensity = isTerminal ? 0.8 : 1.0;
        if (pointLight) pointLight.intensity = isTerminal ? 5.0 : 2.0;
        if (dirLight) dirLight.intensity = isTerminal ? 2.0 : 1.5;

        if (useSkybox) { if (bgMesh && !scene.children.includes(bgMesh)) scene.add(bgMesh); }
        else { if (bgMesh && scene.children.includes(bgMesh)) scene.remove(bgMesh); }

        if (trails) {
            const tMat = trails.material as THREE.LineBasicMaterial;
            tMat.color.set(color);
            // Blueprint mode benefits from slightly stronger trails (wireframe + grid can wash them out).
            // Terminal mode should keep trails a bit subtler to avoid visual "burn-in" feeling.
            tMat.opacity = isTerminal ? 0.28 : 0.55;
            trails.visible = showTrails;
        }
        if (predator) { 
            const pMat = predator.material as THREE.MeshLambertMaterial;
            const bgCol = new THREE.Color(backgroundColor);
            const bgLuma = 0.2126 * bgCol.r + 0.7152 * bgCol.g + 0.0722 * bgCol.b;
            const lightMode = bgLuma > 0.6;
            const forceBloodRed = lightMode && wireframe && !isTerminal;
            const predTone = forceBloodRed ? '#8B0000' : predatorColor;
            pMat.transparent = false;
            pMat.opacity = 1.0;
            pMat.color.set(predTone);
            pMat.emissive.set(predTone);
            pMat.emissiveIntensity = forceBloodRed ? 1.15 : (lightMode ? 0.35 : 0.85);
            pMat.needsUpdate = true;
            predator.visible = true; 
        }
        if (predTrailLine) {
            const pMat = predTrailLine.material as THREE.LineBasicMaterial;
            pMat.color.set(predatorColor);
            pMat.opacity = isTerminal ? 0.35 : 0.55;
            predTrailLine.visible = showTrails;
        }
    });

    $effect(() => {
        // Make trails toggling feel deterministic.
        if (!trails || !predTrailLine) return;
        trails.visible = showTrails;
        predTrailLine.visible = showTrails;
        if (!showTrails) {
            resetTrailHistory();
            resetPredTrailHistory();
        }
    });

    let predTargetIdx = -1;
    let predTargetUntil = 0;
    const _baseCol = new THREE.Color();
    const _whiteCol = new THREE.Color(0xffffff);

    let frameStartTime = 0;
    let lastFrameTime = 0;
    let avgFrameTime = 0;

    function gridCoord(v: number) {
        return Math.min(gridCellsCount - 1, Math.max(0, Math.floor(((v + GRID_EXTENT) / GRID_SPAN) * gridCellsCount)));
    }

    function gridIndex(x: number, y: number, z: number) {
        return x + y * gridCellsCount + z * gridCellsCount * gridCellsCount;
    }

    function rebuildSpatialGrid() {
        gridHeaders.fill(-1);
        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            const cell = gridIndex(gridCoord(positions[idx]), gridCoord(positions[idx + 1]), gridCoord(positions[idx + 2]));
            boidNext[i] = gridHeaders[cell];
            gridHeaders[cell] = i;
        }
    }

    function updatePredator(dtNorm: number, now: number) {
        if (predTargetIdx < 0 || now > predTargetUntil) {
            predTargetIdx = Math.floor(Math.random() * boidCount);
            predTargetUntil = now + 5000;
        }

        const tIdx = predTargetIdx * 3;
        const predict = _lookAt.set(
            positions[tIdx] + velocities[tIdx] * PREDATOR_PREDICT_T,
            positions[tIdx + 1] + velocities[tIdx + 1] * PREDATOR_PREDICT_T,
            positions[tIdx + 2] + velocities[tIdx + 2] * PREDATOR_PREDICT_T
        );

        _diff.copy(predict).sub(_predPos);
        if (_diff.lengthSq() > 0.001) {
            const steer = _scratchV1.copy(_diff).setLength(PREDATOR_SPEED).sub(_predVel).clampLength(0, PREDATOR_MAX_STEER);
            _predVel.addScaledVector(steer, dtNorm).clampLength(PREDATOR_MIN_SPEED, PREDATOR_SPEED);
        }

        const pTurn = 0.08 * dtNorm;
        if (_predPos.x < -BOUNDARY_SIZE) _predVel.x += pTurn;
        if (_predPos.x > BOUNDARY_SIZE) _predVel.x -= pTurn;
        if (_predPos.y < -BOUNDARY_SIZE) _predVel.y += pTurn;
        if (_predPos.y > BOUNDARY_SIZE) _predVel.y -= pTurn;
        if (_predPos.z < 20) _predVel.z += pTurn;
        if (_predPos.z > BOUNDARY_SIZE + 20) _predVel.z -= pTurn;

        _predVel.clampLength(PREDATOR_MIN_SPEED, PREDATOR_SPEED);
        _predPos.addScaledVector(_predVel, dtNorm);
    }

    function simulateBoidsStep(dtNorm: number, now: number, t: number, intFactor: number) {
        const maxObs = boidCount * (isTerminal ? 0.55 : 0.20);
        rebuildSpatialGrid();

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            _acceleration.set(0, 0, 0);
            let nextDeath = deathTimers[i];

            if (nextDeath > 0) {
                nextDeath -= 0.025 * dtNorm;
                if (nextDeath <= 0) {
                    nextDeath = 0;
                    _position.set((Math.random() - 0.5) * 350, (Math.random() - 0.5) * 350, 20 + Math.random() * 100);
                    _velocity.set((Math.random() - 0.5), (Math.random() - 0.5), 1).normalize().multiplyScalar(SPEED_LIMIT);
                }
                positionsNext[idx] = _position.x; positionsNext[idx + 1] = _position.y; positionsNext[idx + 2] = _position.z;
                velocitiesNext[idx] = _velocity.x; velocitiesNext[idx + 1] = _velocity.y; velocitiesNext[idx + 2] = _velocity.z;
                deathTimersNext[i] = nextDeath;
                continue;
            }

            const isObserver = intFactor > 0.02 && (i < maxObs * intFactor);
            if (isObserver && uiRect) {
                const targetScreen = computeObserverScreenTarget(i, t);
                const depthLayer = ((i % 5) - 2) * 6;
                const targetDistance = (OBSERVER_DISTANCE_FROM_CAMERA - intFactor * 6) + depthLayer;
                const targetWorld = screenToWorldAtDistance(targetScreen.x, targetScreen.y, targetDistance, _scratchV3);
                _predDesiredDir.copy(targetWorld).sub(_position);
                const dist = _predDesiredDir.length();
                if (dist > 0.001) {
                    const speedScale = 0.25 + 0.75 * recruitmentLevel;
                    const desiredSpeed = Math.min(OBSERVER_MAX_SPEED, (0.1 + dist * 0.016) * speedScale);
                    const steer = _scratchV1
                        .copy(_predDesiredDir)
                        .multiplyScalar(desiredSpeed / dist)
                        .sub(_velocity)
                        .clampLength(0, (0.03 + recruitmentLevel * 0.035) * dtNorm);
                    _velocity.addScaledVector(steer, dtNorm);
                    if (dist < 12) _velocity.multiplyScalar(Math.pow(0.9, dtNorm));
                }
                const obsCount = Math.min(boidCount, Math.floor(maxObs * intFactor));
                _scratchV2.set(0, 0, 0);
                for (let j = 0; j < obsCount; j++) {
                    if (j === i || deathTimers[j] > 0) continue;
                    const jIdx = j * 3;
                    const ddx = _position.x - positions[jIdx];
                    const ddy = _position.y - positions[jIdx + 1];
                    const ddz = _position.z - positions[jIdx + 2];
                    const dSq = ddx * ddx + ddy * ddy + ddz * ddz;
                    if (dSq > 0.001 && dSq < OBSERVER_SEPARATION_SQ) {
                        const inv = 1 / Math.sqrt(dSq);
                        const repel = (1 - (dSq / OBSERVER_SEPARATION_SQ)) * 0.08;
                        _scratchV2.x += ddx * inv * repel;
                        _scratchV2.y += ddy * inv * repel;
                        _scratchV2.z += ddz * inv * repel;
                    }
                }
                if (_scratchV2.lengthSq() > 0.0001) _velocity.addScaledVector(_scratchV2, dtNorm);
                _velocity.multiplyScalar(Math.pow(0.975, dtNorm));
                _velocity.clampLength(0.02, OBSERVER_MAX_SPEED);
                _position.addScaledVector(_velocity, dtNorm);
            } else {
                _alignF.set(0, 0, 0);
                _cohF.set(0, 0, 0);
                _sepF.set(0, 0, 0);
                let aC = 0;
                let cC = 0;
                let sC = 0;
                let nearCount = 0;
                let farSlot = 0;
                let farDist = -1;

                const cx = gridCoord(_position.x);
                const cy = gridCoord(_position.y);
                const cz = gridCoord(_position.z);

                for (let dz = -1; dz <= 1; dz++) {
                    const gz = cz + dz;
                    if (gz < 0 || gz >= gridCellsCount) continue;
                    for (let dy = -1; dy <= 1; dy++) {
                        const gy = cy + dy;
                        if (gy < 0 || gy >= gridCellsCount) continue;
                        for (let dx = -1; dx <= 1; dx++) {
                            const gx = cx + dx;
                            if (gx < 0 || gx >= gridCellsCount) continue;
                            let j = gridHeaders[gridIndex(gx, gy, gz)];
                            while (j !== -1) {
                                if (j !== i && deathTimers[j] <= 0) {
                                    const jIdx = j * 3;
                                    const ddx = _position.x - positions[jIdx];
                                    const ddy = _position.y - positions[jIdx + 1];
                                    const ddz = _position.z - positions[jIdx + 2];
                                    const dSq = ddx * ddx + ddy * ddy + ddz * ddz;
                                    if (dSq > 0.0001) {
                                        if (dSq < PROTECTED_RANGE_SQ) {
                                            const inv = 1 / (dSq + 0.01);
                                            _sepF.x += ddx * inv;
                                            _sepF.y += ddy * inv;
                                            _sepF.z += ddz * inv;
                                            sC++;
                                        }
                                        if (dSq < VISUAL_RANGE_SQ) {
                                            if (nearCount < NEIGHBOR_COUNT) {
                                                neighborIdx[nearCount] = j;
                                                neighborDistSq[nearCount] = dSq;
                                                if (dSq > farDist) {
                                                    farDist = dSq;
                                                    farSlot = nearCount;
                                                }
                                                nearCount++;
                                            } else if (dSq < farDist) {
                                                neighborIdx[farSlot] = j;
                                                neighborDistSq[farSlot] = dSq;
                                                farSlot = 0;
                                                farDist = neighborDistSq[0];
                                                for (let n = 1; n < NEIGHBOR_COUNT; n++) {
                                                    if (neighborDistSq[n] > farDist) {
                                                        farDist = neighborDistSq[n];
                                                        farSlot = n;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                j = boidNext[j];
                            }
                        }
                    }
                }

                for (let n = 0; n < nearCount; n++) {
                    const jIdx = neighborIdx[n] * 3;
                    _cohF.x += positions[jIdx];
                    _cohF.y += positions[jIdx + 1];
                    _cohF.z += positions[jIdx + 2];
                    _alignF.x += velocities[jIdx];
                    _alignF.y += velocities[jIdx + 1];
                    _alignF.z += velocities[jIdx + 2];
                    cC++;
                    aC++;
                }

                if (sC > 0) _acceleration.add(_sepF.multiplyScalar(SEPARATION_WEIGHT * 0.09));
                if (cC > 0) {
                    _scratchV1.copy(_cohF).divideScalar(cC).sub(_position).multiplyScalar(COHESION_WEIGHT * 0.004);
                    _acceleration.add(_scratchV1);
                }
                if (aC > 0) {
                    _scratchV1.copy(_alignF).divideScalar(aC).sub(_velocity).multiplyScalar(ALIGNMENT_WEIGHT * 0.05);
                    _acceleration.add(_scratchV1);
                }

                const dxP = _position.x - _predPos.x;
                const dyP = _position.y - _predPos.y;
                const dzP = _position.z - _predPos.z;
                const dSqP = dxP * dxP + dyP * dyP + dzP * dzP;
                const predRangeSq = PREDATOR_RADIUS * PREDATOR_RADIUS;
                if (dSqP < predRangeSq) {
                    const fear = 0.2 + (1 - (dSqP / predRangeSq)) * 0.3;
                    _acceleration.add(_scratchV1.set(dxP, dyP, dzP).normalize().multiplyScalar(fear));
                    if (dSqP < EAT_RADIUS_SQ) nextDeath = 1.0;
                }

                const edgeK = 0.012;
                if (_position.x < -BOUNDARY_SIZE) _acceleration.x += (-BOUNDARY_SIZE - _position.x) * edgeK;
                if (_position.x > BOUNDARY_SIZE) _acceleration.x -= (_position.x - BOUNDARY_SIZE) * edgeK;
                if (_position.y < -BOUNDARY_SIZE) _acceleration.y += (-BOUNDARY_SIZE - _position.y) * edgeK;
                if (_position.y > BOUNDARY_SIZE) _acceleration.y -= (_position.y - BOUNDARY_SIZE) * edgeK;
                if (_position.z < 20) _acceleration.z += (20 - _position.z) * edgeK;
                if (_position.z > BOUNDARY_SIZE + 20) _acceleration.z -= (_position.z - (BOUNDARY_SIZE + 20)) * edgeK;

                const dxT = _position.x - target.x;
                const dyT = _position.y - target.y;
                const dzT = _position.z - target.z;
                const dSqToTarget = dxT * dxT + dyT * dyT + dzT * dzT;
                if (dSqToTarget < MOUSE_REPULSION_SQ) {
                    const repel = (1 - (dSqToTarget / MOUSE_REPULSION_SQ)) * MOUSE_REPULSION_WEIGHT * 0.05;
                    _acceleration.add(_scratchV1.set(dxT, dyT, dzT).normalize().multiplyScalar(repel));
                }

                const wOff = t * 0.11 + i * 0.173;
                _scratchV1.set(Math.sin(wOff) * 0.008, Math.cos(wOff * 0.8) * 0.008, Math.sin(wOff * 0.47) * 0.006);
                _acceleration.add(_scratchV1);
                _acceleration.clampLength(0, 0.1);

                _velocity.addScaledVector(_acceleration, dtNorm);
                const speed = _velocity.length();
                if (speed > 0.0001) {
                    const desiredSpeed = Math.min(maxSpeeds[i], TARGET_SPEED + (scales[i] - 0.75) * 0.2);
                    const speedDelta = (desiredSpeed - speed) * SPEED_FORCE * dtNorm;
                    _velocity.add(_scratchV1.copy(_velocity).divideScalar(speed).multiplyScalar(speedDelta));
                }
                _velocity.clampLength(0.08, maxSpeeds[i]);
                _position.addScaledVector(_velocity, dtNorm);
            }

            positionsNext[idx] = _position.x; positionsNext[idx + 1] = _position.y; positionsNext[idx + 2] = _position.z;
            velocitiesNext[idx] = _velocity.x; velocitiesNext[idx + 1] = _velocity.y; velocitiesNext[idx + 2] = _velocity.z;
            deathTimersNext[i] = nextDeath;
        }

        const pSwap = positions;
        positions = positionsNext;
        positionsNext = pSwap;

        const vSwap = velocities;
        velocities = velocitiesNext;
        velocitiesNext = vSwap;

        const dSwap = deathTimers;
        deathTimers = deathTimersNext;
        deathTimersNext = dSwap;

        updatePredator(dtNorm, now);
    }

    function updateBoidInstances(t: number, intFactor: number, dtNorm: number, typingRampFactor: number) {
        const maxObs = boidCount * (isTerminal ? 0.55 : 0.20);
        const alpha = 1 - Math.pow(1 - ORIENTATION_SMOOTHING, Math.max(0.5, dtNorm));
        _baseCol.set(color);

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            const qIdx = i * 4;
            const d = deathTimers[i];
            _position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            _velocity.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            let observerShakeAmp = 0;

            if (d > 0) {
                _tempColor.set(0xff0000).lerp(_baseCol, 1.0 - d);
                _lookAt.copy(_position).add(_velocity);
                _dummy.scale.setScalar(scales[i] * Math.max(0.1, d));
            } else {
                const isObserver = intFactor > 0.02 && (i < maxObs * intFactor);
                if (isObserver && uiRect) {
                    _lookAt.copy(screenToWorldAtDistance(window.innerWidth * 0.5, window.innerHeight * 0.5, OBSERVER_DISTANCE_FROM_CAMERA + 28, _scratchV1));
                    const pulse = 1.0 + Math.sin(t * (2.0 + recruitmentLevel * 2.0) + i) * (0.05 + recruitmentLevel * 0.1);
                    const flash = Math.max(0, Math.sin(t * (10 + typingRampFactor * 22) + i * 0.9)) * (0.04 + typingRampFactor * 0.26);
                    observerShakeAmp = isTerminal ? (0.02 + typingRampFactor * typingRampFactor * 1.15) * Math.max(0.2, intFactor) : 0;
                    _tempColor.copy(_baseCol);
                    if (recruitmentLevel > 0.2) _tempColor.lerp(_whiteCol, Math.min((recruitmentLevel - 0.2) * 1.5, 0.95));
                    _tempColor.multiplyScalar(pulse);
                    if (flash > 0) _tempColor.lerp(_whiteCol, Math.min(0.42, flash));
                } else {
                    _lookAt.copy(_position).add(_velocity);
                    _tempColor.copy(_baseCol).multiplyScalar(0.72 + (scales[i] - 0.7) * 0.5);
                }
                _dummy.scale.setScalar(scales[i]);
            }

            _quatCurrent.set(orientations[qIdx], orientations[qIdx + 1], orientations[qIdx + 2], orientations[qIdx + 3]);
            _dummy.position.copy(_position);
            if (observerShakeAmp > 0) {
                _dummy.position.x += Math.sin(t * (14 + typingRampFactor * 40) + i * 1.37) * observerShakeAmp;
                _dummy.position.y += Math.cos(t * (17 + typingRampFactor * 45) + i * 1.73) * observerShakeAmp;
                _dummy.position.z += Math.sin(t * (13 + typingRampFactor * 34) + i * 2.11) * observerShakeAmp * 0.7;
            }
            _dummy.lookAt(_lookAt);
            _quatTarget.copy(_dummy.quaternion);
            _quatCurrent.slerp(_quatTarget, alpha);
            _dummy.quaternion.copy(_quatCurrent);

            orientations[qIdx] = _dummy.quaternion.x;
            orientations[qIdx + 1] = _dummy.quaternion.y;
            orientations[qIdx + 2] = _dummy.quaternion.z;
            orientations[qIdx + 3] = _dummy.quaternion.w;

            mesh.setColorAt(i, _tempColor);
            _dummy.updateMatrix();
            mesh.setMatrixAt(i, _dummy.matrix);
        }

        mesh.instanceColor!.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;
    }

    function animate() {
        frameStartTime = performance.now();
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) { 
            fps = frameCount; 
            frameCount = 0; 
            lastTime = now; 
            avgFrameTime = lastFrameTime;
        }
        const t = now * 0.001;

        // Keep the UI bounds updated so Terminal observer mode stays outside the card.
        // (Also fixes cases where the initial bounds accidentally used <main> instead of the terminal card.)
        if (isTerminal) {
            // Avoid repeated DOM queries; only refresh if missing/disconnected.
            if (!uiTargetElement || !uiTargetElement.isConnected) {
                uiTargetElement = (document.getElementById('boid-target') as HTMLElement | null) ?? uiTargetElement;
            }
            updateUIBounds(now);
        }
        
        if (bgMesh) {
            const m = bgMesh.material as THREE.ShaderMaterial;
            m.uniforms.time.value = t;
            m.uniforms.dayPhase.value = (t * 0.004 + 0.25) % 1.0;
        }

        if (pointLight) {
            if (isTerminal && typingPoint) {
                _diff.set((typingPoint.x/window.innerWidth)*2-1, -(typingPoint.y/window.innerHeight)*2+1, 0.5).unproject(camera);
                pointLight.position.lerp(_diff, 0.1);
            } else { pointLight.position.set(mouse.x*100, mouse.y*100, 250); }
        }
        if (dirLight) dirLight.position.set(camera.position.x, camera.position.y, 300);

        target.set((mouse.x * window.innerWidth) / 20, -(mouse.y * window.innerHeight) / 20, 0);

        const frameDeltaSec = Math.min(MAX_FRAME_DELTA_SEC, Math.max(0.0001, (now - simLastTime) * 0.001));
        simLastTime = now;
        const frameDtNorm = frameDeltaSec * 60;

        const timeSinceInteraction = now - lastInteractionTime;
        const interactionActive = isTerminal && timeSinceInteraction < 60000;
        const currentlyTyping = isTerminal && timeSinceInteraction < 280;
        if (currentlyTyping) typingDurationSec = Math.min(30, typingDurationSec + frameDeltaSec);
        else typingDurationSec = Math.max(0, typingDurationSec - frameDeltaSec * 2.4);
        const typingRampFactor = typingDurationSec / 30;
        if (isTerminal && timeSinceInteraction < 2000) recruitmentLevel = Math.min(1, recruitmentLevel + 0.0005 * frameDtNorm);
        else recruitmentLevel = Math.max(0, recruitmentLevel - 0.008 * frameDtNorm);

        // Update UI rect dynamically (throttled) for drag tracking.
        if (recruitmentLevel > 0 && !isTerminal) {
            if (!uiTargetElement || !uiTargetElement.isConnected) {
                uiTargetElement = (document.getElementById('boid-target') as HTMLElement | null) ?? uiTargetElement;
            }
            updateUIBounds(now);
        }

        const intFactor = recruitmentLevel * (interactionActive ? Math.pow(Math.max(0, 1 - (timeSinceInteraction / 60000)), 0.5) : 0);
        if (bgMesh) {
            const m = bgMesh.material as THREE.ShaderMaterial;
            const observedPulse = intFactor > 0.08 ? (0.5 + 0.5 * Math.sin(t * 2.4)) * 0.14 : 0;
            m.uniforms.tension.value = Math.min(1, recruitmentLevel + observedPulse);
            m.uniforms.pulse.value = intFactor > 0.08 ? (0.5 + 0.5 * Math.sin(t * (2.1 + typingRampFactor * 2.8))) * (0.12 + typingRampFactor * 0.24) : 0;
        }
        const simSubsteps = Math.min(MAX_SIM_SUBSTEPS, Math.max(1, Math.ceil(frameDeltaSec / MAX_SIM_STEP_SEC)));
        const simStepNorm = frameDtNorm / simSubsteps;
        for (let s = 0; s < simSubsteps; s++) {
            simulateBoidsStep(simStepNorm, now, t, intFactor);
        }
        updateBoidInstances(t, intFactor, frameDtNorm, typingRampFactor);

        // Update Trails
        if (showTrails && trails) {
            const attr = trails.geometry.getAttribute('position') as THREE.BufferAttribute;
            const h = attr.array as Float32Array;
            for (let i = 0; i < boidCount; i++) {
                if (deathTimers[i] > 0) continue; 
                const bIdx = i * 3;
                const tOff = i * TRAIL_LENGTH * 3;
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

        if (predator) { 
            predator.position.copy(_predPos); 
            if (_predVel.lengthSq() > 0.001) predator.lookAt(_lookAt.copy(_predPos).add(_predVel)); 
        }

        if (mesh && debugMode) {
            if (!debugMaterial) debugMaterial = new THREE.MeshNormalMaterial();
            const originalMat = mesh.material;
            mesh.material = debugMaterial;
            renderer.render(scene, camera);
            mesh.material = originalMat;
        } else {
            renderer.render(scene, camera);
        }
        lastFrameTime = performance.now() - frameStartTime;
    }

    onMount(() => {
        init();
        simLastTime = performance.now();
        animate();
        uiTargetElement = (document.getElementById('boid-target') as HTMLElement | null) ?? (document.querySelector('main') as HTMLElement | null);
        if (uiTargetElement) {
            uiRect = uiTargetElement.getBoundingClientRect();
            updateUIBounds(performance.now());
        }
        const onResize = () => {
            if (camera && renderer) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
            uiTargetElement = (document.getElementById('boid-target') as HTMLElement | null) ?? uiTargetElement;
            if (uiTargetElement) uiRect = uiTargetElement.getBoundingClientRect();
            updateUIBounds(performance.now());
        };
        const onMouseMove = (e: MouseEvent) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);

        onDestroy(() => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
        });
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            if (frameId) cancelAnimationFrame(frameId);
            if (renderer) renderer.dispose();
            if (debugMaterial) debugMaterial.dispose();
        }
    });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>
