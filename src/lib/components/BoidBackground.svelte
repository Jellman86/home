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

    let debugMode = $state(false);

    export function getDiagnosticsData(): string {
        const data: any = {
            timestamp: new Date().toISOString(),
            buildHash: typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'unknown',
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
                    tension: (bgMesh.material as THREE.ShaderMaterial).uniforms.tension.value
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

        if (mesh) {
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
                    type: mesh.material.type,
                    color: (mesh.material as any).color.getHexString(),
                    emissive: (mesh.material as any).emissive?.getHexString(),
                    emissiveIntensity: (mesh.material as any).emissiveIntensity,
                    vertexColors: mesh.material.vertexColors,
                    transparent: mesh.material.transparent,
                    opacity: mesh.material.opacity,
                    wireframe: (mesh.material as any).wireframe
                }
            };

            const colorAttr = mesh.geometry.getAttribute('instanceColor');
            if (colorAttr) {
                data.instanceColorBuffer = {
                    count: colorAttr.count,
                    itemSize: colorAttr.itemSize,
                    usage: colorAttr.usage,
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

    let mouse = new THREE.Vector2(-9999, -9999);
    let target = new THREE.Vector3();
    let uiRect: DOMRect | null = null;
    let mainElement: HTMLElement | null = null;
    
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
    const TARGET_SPEED = 0.83;
    const SPEED_FORCE = 0.025;
    const PREDATOR_RADIUS = 55;
    const PREDATOR_SPEED = 1.08; 
    const PREDATOR_MIN_SPEED = 0.9;
    const PREDATOR_MAX_STEER = 0.04;
    const PREDATOR_PREDICT_T = 18;
    
    let SPEED_LIMIT = $derived(0.8);
    let VISUAL_RANGE = $derived(45); 
    let PROTECTED_RANGE = $derived(8);
    let SEPARATION_WEIGHT = $derived(2.5); 
    let ALIGNMENT_WEIGHT = $derived(4.0); 
    let COHESION_WEIGHT = $derived(1.5); 
    const MOUSE_REPULSION_WEIGHT = 12.0;

    const VISUAL_RANGE_SQ = 45 * 45;
    const PROTECTED_RANGE_SQ = 8 * 8;
    const MOUSE_REPULSION_SQ = 4500;

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
            uniforms: { time: { value: 0 }, dayPhase: { value: 0.25 }, tension: { value: 0 } },
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
        scales = new Float32Array(boidCount);
        
        // Grid Initialization
        gridCellsCount = Math.ceil((BOUNDARY_SIZE * 2.5) / GRID_SIZE);
        const totalCells = gridCellsCount * gridCellsCount * gridCellsCount;
        gridHeaders = new Int32Array(totalCells);
        boidNext = new Int32Array(boidCount);
        mainElement = document.querySelector('main');

        const baseColor = new THREE.Color(color);
        for (let i = 0; i < boidCount; i++) {
            _position.set((Math.random()-0.5)*250, (Math.random()-0.5)*250, 20+Math.random()*100);
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

        // Initialize predator near a random boid
        const startIdx = Math.floor(Math.random() * boidCount) * 3;
        _predPos.set(positions[startIdx], positions[startIdx+1], positions[startIdx+2]);
        _predVel.set(velocities[startIdx], velocities[startIdx+1], velocities[startIdx+2]).setLength(PREDATOR_SPEED);

        // TRAILS
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
        trails = new THREE.LineSegments(trailGeo, trailMat);
        trails.visible = showTrails;
        scene.add(trails);

        const predTrailGeo = new THREE.BufferGeometry();
        predTrailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PRED_TRAIL_LENGTH * 3), 3));
        predTrailLine = new THREE.Line(predTrailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        predTrailLine.visible = showTrails;
        scene.add(predTrailLine);
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

        if (trails) { (trails.material as THREE.LineBasicMaterial).color.set(color); trails.visible = showTrails; }
        if (predator) { 
            const pMat = predator.material as THREE.MeshLambertMaterial;
            pMat.color.set(0xffffff);
            pMat.emissive.set(predatorColor);
            pMat.emissiveIntensity = 1.0;
            predator.visible = true; 
        }
        if (predTrailLine) { (predTrailLine.material as THREE.LineBasicMaterial).color.set(predatorColor); predTrailLine.visible = showTrails; }
    });

    let predTargetIdx = -1;
    let predTargetUntil = 0;
    const _baseCol = new THREE.Color();
    const _whiteCol = new THREE.Color(0xffffff);

    let frameStartTime = 0;
    let lastFrameTime = 0;
    let avgFrameTime = 0;

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
        
        if (bgMesh) {
            const m = bgMesh.material as THREE.ShaderMaterial;
            m.uniforms.time.value = t;
            m.uniforms.dayPhase.value = (t * 0.004 + 0.25) % 1.0;
            m.uniforms.tension.value = recruitmentLevel;
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

        // Update UI Rect dynamically for drag tracking
        if (recruitmentLevel > 0) {
            const el = document.getElementById('boid-target');
            if (el) uiRect = el.getBoundingClientRect();
        }

        // PERFORMANCE: Build Spatial Grid (Allocation-Free)
        const gridOffset = BOUNDARY_SIZE * 1.25;
        gridHeaders.fill(-1);
        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            const gx = Math.floor((positions[idx] + gridOffset) / GRID_SIZE);
            const gy = Math.floor((positions[idx+1] + gridOffset) / GRID_SIZE);
            const gz = Math.floor((positions[idx+2] + gridOffset) / GRID_SIZE);
            
            if (gx >= 0 && gx < gridCellsCount && gy >= 0 && gy < gridCellsCount && gz >= 0 && gz < gridCellsCount) {
                const cellKey = gx + gy * gridCellsCount + gz * gridCellsCount * gridCellsCount;
                boidNext[i] = gridHeaders[cellKey];
                gridHeaders[cellKey] = i;
            } else {
                boidNext[i] = -1;
            }
        }

        const maxObs = boidCount * 0.20;
        const intFactor = recruitmentLevel * (interactionActive ? Math.pow(Math.max(0, 1 - (timeSinceInteraction / 60000)), 0.5) : 0);
        _baseCol.set(color);

        const mArray = mesh.instanceMatrix.array;
        const cArray = mesh.instanceColor!.array;

        for (let i = 0; i < boidCount; i++) {
            const idx = i * 3;
            const px = positions[idx], py = positions[idx + 1], pz = positions[idx + 2];
            const vx = velocities[idx], vy = velocities[idx + 1], vz = velocities[idx + 2];
            
            _position.set(px, py, pz);
            _velocity.set(vx, vy, vz);
            _acceleration.set(0, 0, 0);

            const isObserver = intFactor > 0.02 && (i < maxObs * intFactor);

            if (isObserver && uiRect) {
                const angle = (i * 137.5) * (Math.PI / 180); 
                const ring = (i % 4); const margin = 180 + ring * 80; 
                
                const timeOff = t * (0.8 + (i % 5) * 0.2) + i;
                const jitterX = Math.sin(timeOff) * 25;
                const jitterY = Math.cos(timeOff * 0.7) * 25;

                let tsx = (uiRect.left + uiRect.right) * 0.5 + Math.cos(angle) * (uiRect.width * 0.5 + margin) + jitterX;
                let tsy = (uiRect.top + uiRect.bottom) * 0.5 + Math.sin(angle) * (uiRect.height * 0.5 + margin) + jitterY;
                
                _diff.set((tsx / window.innerWidth) * 2 - 1, -(tsy / window.innerHeight) * 2 + 1, 0.3).unproject(camera);
                
                const individualLerp = 0.02 + (i % 7) * 0.005;
                _position.lerp(_diff, individualLerp); 
                _velocity.set(Math.sin(timeOff)*0.01, Math.cos(timeOff)*0.01, 0); 
                
                _lookAt.set(((uiRect.left + uiRect.right)*0.5/window.innerWidth)*2-1, -((uiRect.top + uiRect.bottom)*0.5/window.innerHeight)*2+1, 0.5).unproject(camera);
                _dummy.position.copy(_position); _dummy.lookAt(_lookAt);
                
                const pulse = 1.0 + Math.sin(t * (3.0 + recruitmentLevel * 4.0) + i) * (0.1 + recruitmentLevel * 0.2);
                _tempColor.copy(_baseCol);
                if (recruitmentLevel > 0.2) _tempColor.lerp(_whiteCol, Math.min((recruitmentLevel-0.2)*1.5, 0.95));
                _tempColor.multiplyScalar(pulse);
                
                const cIdx = i * 3;
                cArray[cIdx] = _tempColor.r; cArray[cIdx+1] = _tempColor.g; cArray[cIdx+2] = _tempColor.b;
                
                const sVar = 0.3 + (Math.sin(i * 0.7) * 0.15); 
                _dummy.scale.set(sVar, sVar, sVar);
            } else {
                let aliX = 0, aliY = 0, aliZ = 0;
                let cohX = 0, cohY = 0, cohZ = 0;
                let sepX = 0, sepY = 0, sepZ = 0;
                let aC = 0, cC = 0, sC = 0;

                const gx = Math.floor((px + gridOffset) / GRID_SIZE);
                const gy = Math.floor((py + gridOffset) / GRID_SIZE);
                const gz = Math.floor((pz + gridOffset) / GRID_SIZE);

                for (let ox = -1; ox <= 1; ox++) {
                    const nx = gx + ox; if (nx < 0 || nx >= gridCellsCount) continue;
                    for (let oy = -1; oy <= 1; oy++) {
                        const ny = gy + oy; if (ny < 0 || ny >= gridCellsCount) continue;
                        for (let oz = -1; oz <= 1; oz++) {
                            const nz = gz + oz; if (nz < 0 || nz >= gridCellsCount) continue;
                            
                            const cellKey = nx + ny * gridCellsCount + nz * gridCellsCount * gridCellsCount;
                            let boidIdx = gridHeaders[cellKey];
                            
                            while (boidIdx !== -1) {
                                if (boidIdx !== i) {
                                    const oIdx = boidIdx * 3;
                                    const opx = positions[oIdx], opy = positions[oIdx+1], opz = positions[oIdx+2];
                                    const dx = px - opx, dy = py - opy, dz = pz - opz;
                                    const dSq = dx*dx+dy*dy+dz*dz;
                                    
                                    if (dSq < PROTECTED_RANGE_SQ && dSq > 0.01) {
                                        sepX += dx; sepY += dy; sepZ += dz;
                                        sC++;
                                    } else if (dSq < VISUAL_RANGE_SQ) {
                                        cohX += opx; cohY += opy; cohZ += opz;
                                        aliX += velocities[oIdx]; aliY += velocities[oIdx+1]; aliZ += velocities[oIdx+2];
                                        aC++;
                                    }
                                }
                                boidIdx = boidNext[boidIdx];
                            }
                        }
                    }
                }

                if (sC > 0) {
                    _scratchV1.set(sepX, sepY, sepZ).normalize().multiplyScalar(SEPARATION_WEIGHT * 0.12);
                    _acceleration.add(_scratchV1);
                }
                if (cC > 0) {
                    _scratchV1.set(cohX/cC - px, cohY/cC - py, cohZ/cC - pz).normalize().multiplyScalar(COHESION_WEIGHT * 0.01);
                    _acceleration.add(_scratchV1);
                }
                if (aC > 0) {
                    _scratchV1.set(aliX/aC - vx, aliY/aC - vy, aliZ/aC - vz).normalize().multiplyScalar(ALIGNMENT_WEIGHT * 0.06);
                    _acceleration.add(_scratchV1);
                }

                // Stay within boundaries
                const turn = 0.05;
                if (px < -BOUNDARY_SIZE) _acceleration.x += turn;
                if (px > BOUNDARY_SIZE) _acceleration.x -= turn;
                if (py < -BOUNDARY_SIZE) _acceleration.y += turn;
                if (py > BOUNDARY_SIZE) _acceleration.y -= turn;
                if (pz < 20) _acceleration.z += turn;
                if (pz > BOUNDARY_SIZE + 20) _acceleration.z -= turn;

                const dxT = px - target.x, dyT = py - target.y, dzT = pz - target.z;
                const dSqToTarget = dxT*dxT + dyT*dyT + dzT*dzT;
                if (dSqToTarget < MOUSE_REPULSION_SQ) {
                    _scratchV1.set(dxT, dyT, dzT).normalize().multiplyScalar(MOUSE_REPULSION_WEIGHT * 0.045);
                    _acceleration.add(_scratchV1);
                }
                
                _scratchV1.set(Math.sin(py*0.015+t*0.6)*0.008, Math.cos(px*0.012+t*0.5)*0.008, Math.sin((px+py)*0.01+t*0.4)*0.006);
                _acceleration.add(_scratchV1);
                _acceleration.clampLength(0, 0.05);
                _velocity.add(_acceleration).clampLength(0.05, SPEED_LIMIT * 0.8);
                _position.add(_velocity);
                _dummy.position.copy(_position);
                if (_velocity.lengthSq() > 0.0001) _dummy.lookAt(_lookAt.copy(_position).add(_velocity));
                _dummy.scale.set(scales[i], scales[i], scales[i]);
                
                const cIdx = i * 3;
                _tempColor.copy(_baseCol).multiplyScalar(0.7 + (scales[i]-0.7)*0.5);
                cArray[cIdx] = _tempColor.r; cArray[cIdx+1] = _tempColor.g; cArray[cIdx+2] = _tempColor.b;
            }
            positions[idx] = _position.x; positions[idx+1] = _position.y; positions[idx+2] = _position.z;
            velocities[idx] = _velocity.x; velocities[idx+1] = _velocity.y; velocities[idx+2] = _velocity.z;
            _dummy.updateMatrix();
            const mIdx = i * 16;
            for (let m = 0; m < 16; m++) mArray[mIdx + m] = _dummy.matrix.elements[m];
        }
        mesh.instanceColor!.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;

        // Update Trails
        if (showTrails && trails) {
            const attr = trails.geometry.getAttribute('position') as THREE.BufferAttribute;
            const h = attr.array as Float32Array;
            for (let i = 0; i < boidCount; i++) {
                const bIdx = i * 3;
                const tOff = i * TRAIL_LENGTH * 3;
                // PERFORMANCE: Use fast copyWithin instead of manual shifting
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
        const steer = _diff.copy(predict).sub(_predPos).setLength(PREDATOR_SPEED).sub(_predVel).clampLength(0, PREDATOR_MAX_STEER);
        _predVel.add(steer).clampLength(PREDATOR_MIN_SPEED, PREDATOR_SPEED);

        // Predator boundaries
        const pTurn = 0.08;
        if (_predPos.x < -BOUNDARY_SIZE) _predVel.x += pTurn;
        if (_predPos.x > BOUNDARY_SIZE) _predVel.x -= pTurn;
        if (_predPos.y < -BOUNDARY_SIZE) _predVel.y += pTurn;
        if (_predPos.y > BOUNDARY_SIZE) _predVel.y -= pTurn;
        if (_predPos.z < 20) _predVel.z += pTurn;
        if (_predPos.z > BOUNDARY_SIZE + 20) _predVel.z -= pTurn;

        _predPos.add(_predVel);
        if (predator) { predator.position.copy(_predPos); predator.lookAt(_lookAt.copy(_predPos).add(_predVel)); }

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
        init(); animate();
        const updateUIRect = () => { uiRect = (document.querySelector('main') as HTMLElement | null)?.getBoundingClientRect() || null; };
        updateUIRect();
        window.addEventListener('resize', () => { 
            if (camera && renderer) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
            updateUIRect();
        });
        window.addEventListener('mousemove', (e) => { mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1; });
    });

    onDestroy(() => { if (typeof window !== 'undefined') { if (frameId) cancelAnimationFrame(frameId); if (renderer) renderer.dispose(); if (debugMaterial) debugMaterial.dispose(); } });
</script>

<div bind:this={container} class="fixed inset-0 w-full h-full z-0">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>