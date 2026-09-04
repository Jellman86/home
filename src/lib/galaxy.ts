import * as THREE from 'three';
import { GPUComputationRenderer, type Variable } from 'three/addons/misc/GPUComputationRenderer.js';

/**
 * The galaxy the page rests on.
 *
 * A simulation, not a picture of one. Every star carries a position and a
 * velocity and is integrated every frame under gravity: an axisymmetric
 * galactic potential — a soft core with a flat rotation curve, so the
 * inside turns much faster than the rim — plus a weak spiral perturbation
 * that turns rigidly at its own pattern speed. That perturbation is the
 * density wave: stars are not held on the arms, they stream through them,
 * lingering where the potential dips, and the crowding is what you see as
 * the spiral.
 *
 * Two populations, as in a real disc. Old stars orbit forever and are
 * smooth: a bulge and an exponential disc, barely marked by the wave.
 * Young stars are born on the arms — that is where the wave compresses
 * the gas — bright and blue, and over a minute or two they fade and
 * shear away downstream before being reborn in an arm. The sharp spiral
 * you see is the young population; the glow behind it is the old.
 *
 * Nothing else acts on the stars. There is no fake turbulence: an earlier
 * version stirred them with curl noise, and in a real integrator that is
 * a heat source — after a few minutes the disc had puffed out to twice
 * its size. There is no cursor either: the page is something to look at,
 * not something to poke.
 *
 * The nebula underneath is baked from the initial star field — the stars
 * drawn soft and dense into a texture, once — so the haze traces the same
 * arms, and a second bake of the field turned slightly against the
 * rotation lays the dust lanes along the arms' inner edges. It is blended
 * normally, not additively, so the dust can be darker than the page.
 *
 * Layout. The disc is a unit circle in its own coordinates; a fixed tilt
 * and a mild perspective divide put it on screen in an isotropic NDC (y
 * in -1..1, x scaled by aspect), so nothing here goes through the flock's
 * camera. A scrim first pulls the page toward black, and a few fixed
 * foreground stars with diffraction spikes sit in front of everything.
 *
 * Light theme. Light-on-light is invisible however bright, so on a light
 * page the stars are drawn as dark ink with normal blending and the
 * nebula and scrim stay off: a chart of the same galaxy on paper.
 */

export interface GalaxyPalette {
    light: boolean;
    /** The ink stars are drawn in on a light page. Ignored on a dark one. */
    ink: string;
}

export interface Galaxy {
    group: THREE.Group;
    /**
     * Advances the simulation and the uniforms. Call once per frame, before
     * the render.
     * @param nowMs   performance.now()
     * @param aspect  viewport width / height
     * @param opacity 0..1 blend of the whole layer
     */
    update(nowMs: number, aspect: number, opacity: number): void;
    setPalette(palette: GalaxyPalette): void;
    dispose(): void;
}

// --- Where it sits on screen --------------------------------------------
/** Centre of the disc. Up and to the right, so the core clears the panel on
 *  a wide window and the arms sweep the margins either side of it. */
const CENTRE = new THREE.Vector2(1.25, 0.5);
/** Disc radius in isotropic units. */
const SCALE = 1.2;
/** Tilt from face-on, and the roll of the tilted disc's long axis. Shallow:
 *  a spiral reads as a spiral face-on and as a smear edge-on. */
const TILT = 0.62;
const ROLL = -0.5;
/** How much nearer parts of the tilted disc grow. Mild: it is a sky. */
const PERSPECTIVE = 0.25;

// --- The potential --------------------------------------------------------
/** Rotation curve v(r) = V0·r/√(r²+rc²): rising through the core, flat
 *  outside. A star at half a radius goes round in about two minutes, one
 *  at the edge in four, and the core turns in twenty-five seconds. */
const V0 = 0.027;
const CORE_RADIUS = 0.1;
/** The spiral perturbation: two arms, strength as a fraction of V0², a
 *  logarithmic spiral with a pitch angle of about twenty degrees, and the
 *  pattern speed, set to corotate with the stars two thirds of the way
 *  out — inside that the stars overtake the arms, outside they lag.
 *
 *  The strength is small because the log spiral's radial wavenumber is
 *  large, so the sideways force is many times the potential's amplitude:
 *  at 0.14 it rivalled the whole axisymmetric pull and every old star was
 *  torqued into the core or out of the disc within a few orbits. At 0.01
 *  it is a few percent, which is what real arms are. */
const ARMS = 2;
const SPIRAL_STRENGTH = 0.01;
const SPIRAL_PITCH_DEG = 20;
const SPIRAL_K = ARMS / Math.tan((SPIRAL_PITCH_DEG * Math.PI) / 180);
const SPIRAL_R0 = 0.08;
const PATTERN_OMEGA = V0 / Math.sqrt(0.65 * 0.65 + CORE_RADIUS * CORE_RADIUS);
/** Radius where the perturbation is strongest, and its reach. */
const SPIRAL_PEAK = 0.45;
/** Velocity dispersion of newly seeded stars, as a fraction of circular. */
const DISPERSION = 0.05;
/** Share of stars that are young, and how long they live. Long: turnover
 *  of well under a percent a second is invisible star by star. */
const YOUNG_SHARE = 0.45;
/** Short next to the shear: a star that lived long enough to drift half
 *  way round would smear the arm it was born in into a ring. */
const LIFE_MIN = 26;
const LIFE_SPAN = 34;
/** Beyond this a star has left, and is reseeded. */
const KILL_RADIUS = 1.7;
/** Where the dust sits: the field turned back a little against the
 *  rotation, so the lanes hug the inner edge of each arm. */
const DUST_TURN = -0.22;

const BAKE_SIZE = 512;
const EXTENT = 1.3;
const FIELD_COUNT = 260;
const SCRIM = 0.62;

const HASH = /* glsl */ `
    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }
    float gauss(vec2 seed) {
        float u = max(1e-6, hash12(seed));
        float v = hash12(seed + 17.3);
        return sqrt(-2.0 * log(u)) * cos(6.2831853 * v);
    }
`;

/**
 * The galaxy's gravity, as a potential; the acceleration is its gradient.
 * `pattern` is the angle the spiral has turned through.
 */
const POTENTIAL = /* glsl */ `
    float circularSpeed(float r) {
        return ${V0.toFixed(4)} * r / sqrt(r * r + ${(CORE_RADIUS * CORE_RADIUS).toFixed(4)});
    }
    float armPhase(vec2 p, float r, float pattern) {
        float theta = atan(p.y, p.x);
        return ${ARMS.toFixed(1)} * (theta - pattern) - ${SPIRAL_K.toFixed(4)} * log(r / ${SPIRAL_R0.toFixed(3)});
    }
    float potential(vec2 p, float pattern) {
        float r2 = dot(p, p);
        float r = sqrt(r2 + 1e-6);
        float axi = 0.5 * ${(V0 * V0).toFixed(6)} * log(r2 + ${(CORE_RADIUS * CORE_RADIUS).toFixed(4)});
        // The spiral: strongest in the inner disc, gone in the bulge and
        // past the rim.
        float g = (r / ${SPIRAL_PEAK.toFixed(3)}) * exp(1.0 - r / ${SPIRAL_PEAK.toFixed(3)}) * smoothstep(0.04, 0.16, r);
        float spiral = -${SPIRAL_STRENGTH.toFixed(3)} * ${(V0 * V0).toFixed(6)} * g * cos(armPhase(p, r, pattern));
        return axi + spiral;
    }
`;

/**
 * Where a star is seeded, and how fast it is going. Mirrored in `seedJs`
 * for the initial fill; the two must describe the same distribution.
 * Young stars are born on the arms; old ones in the bulge and disc.
 */
const SEED = /* glsl */ `
    vec4 seed(vec2 sd, float pattern, bool young) {
        float u = hash12(sd + 5.7);
        float th = hash12(sd + 9.2) * 6.2831853;
        float r;
        vec2 p;
        if (young) {
            r = 0.12 + 0.95 * pow(u, 0.8);
            float arm = floor(hash12(sd + 12.9) * ${ARMS.toFixed(1)}) * ${((Math.PI * 2) / ARMS).toFixed(5)};
            float across = gauss(sd + 21.7) * (0.015 + 0.05 * r);
            float ang = pattern + arm + ${(SPIRAL_K / ARMS).toFixed(4)} * log(r / ${SPIRAL_R0.toFixed(3)}) + across / r;
            p = vec2(cos(ang), sin(ang)) * r;
        } else if (hash12(sd + 3.1) < 0.22) {
            r = abs(gauss(sd + 1.3)) * 0.07;
            p = vec2(cos(th), sin(th)) * r;
        } else {
            // Exponential disc, scale length 0.4, cut at the rim.
            r = -0.4 * log(1.0 - u * 0.936);
            p = vec2(cos(th), sin(th)) * r;
        }
        r = max(length(p), 1e-4);
        // Circular, clockwise, with a little dispersion.
        float vc = circularSpeed(r) * (1.0 + ${DISPERSION.toFixed(3)} * gauss(sd + 31.1));
        vec2 v = vec2(p.y, -p.x) / r * vc + vec2(gauss(sd + 41.7), gauss(sd + 51.3)) * ${(DISPERSION * V0).toFixed(5)};
        return vec4(p, v);
    }
`;

/** One step of the dynamics. xy is position in the disc plane, zw velocity. */
const COMPUTE_FRAG = /* glsl */ `
    uniform float uTime;
    uniform float uDt;
    uniform float uPattern;
    ${HASH}
    ${POTENTIAL}
    ${SEED}

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 s = texture2D(texPos, uv);
        vec4 age = texture2D(texAge, uv);
        vec2 p = s.xy;
        vec2 v = s.zw;

        bool young = age.y > 0.0;
        bool expired = young && age.x >= age.y;
        bool broken = !(dot(p, p) < ${(KILL_RADIUS * KILL_RADIUS).toFixed(3)}) || !(dot(v, v) < 1.0);
        if (expired || broken) {
            gl_FragColor = seed(uv * 61.7 + vec2(uTime * 0.731, uTime * 0.293), uPattern, young);
            return;
        }

        // Gravity: the gradient of the potential, by central differences.
        const float e = 0.004;
        vec2 a = -vec2(
            potential(p + vec2(e, 0.0), uPattern) - potential(p - vec2(e, 0.0), uPattern),
            potential(p + vec2(0.0, e), uPattern) - potential(p - vec2(0.0, e), uPattern)
        ) / (2.0 * e);

        v += a * uDt;
        p += v * uDt;
        gl_FragColor = vec4(p, v);
    }
`;

/** Ages. x is age in seconds, y the lifetime — zero for a star that is old
 *  and immortal. Must agree with the position pass on when a star dies. */
const AGE_FRAG = /* glsl */ `
    uniform float uTime;
    uniform float uDt;
    ${HASH}
    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 a = texture2D(texAge, uv);
        if (a.y > 0.0) {
            if (a.x >= a.y) {
                a.x = 0.0;
                a.y = ${LIFE_MIN.toFixed(1)} + ${LIFE_SPAN.toFixed(1)} * hash12(uv * 61.7 + vec2(uTime * 0.731, uTime * 0.293) + 40.1);
            } else {
                a.x += uDt;
            }
        }
        gl_FragColor = a;
    }
`;

/** The stars. Position from the simulation; everything else attributes. */
const STAR_VERT = /* glsl */ `
    uniform sampler2D uPos;
    uniform sampler2D uAge;
    uniform mat3 uView;
    uniform vec2 uCentre;
    uniform float uScale;
    uniform float uPersp;
    uniform float uAspect;
    uniform float uDpr;
    uniform float uTime;
    uniform float uPattern;
    uniform float uOpacity;
    uniform float uGain;
    uniform vec3 uCool;
    uniform vec3 uWhite;
    uniform vec3 uWarm;
    attribute vec2 aRef;
    attribute float aMag;
    attribute float aTemp;
    attribute float aZ;
    attribute vec2 aTwinkle;
    varying vec3 vCol;
    varying float vI;
    varying float vSpike;
    varying float vSprite;

    void main() {
        vec2 p = texture2D(uPos, aRef).xy;
        vec2 age = texture2D(uAge, aRef).xy;
        float r = length(p);
        bool young = age.y > 0.0;
        // Young: in over a few seconds, brightest early, gone by the end.
        // Old: steady, and dimmer.
        float env = young
            ? smoothstep(0.0, 3.0, age.x) * (1.0 - smoothstep(0.25, 1.0, age.x / age.y)) * 1.4
            : 0.6;

        // Thickness: fat in the bulge, a sheet in the arms.
        float z = aZ * (0.012 + 0.09 * exp(-r * r * 60.0));
        vec3 pv = uView * vec3(p, z);
        float w = 1.0 - pv.z * uPersp;
        vec2 iso = uCentre * w + uScale * pv.xy;
        gl_Position = vec4(iso.x / uAspect, iso.y, 0.9995 * w, w);

        // Past the rim the disc thins into a faint halo.
        env *= 1.0 - 0.85 * smoothstep(0.9, 1.25, r);

        float tw = sin(uTime * aTwinkle.y + aTwinkle.x) * 0.6
                 + sin(uTime * aTwinkle.y * 2.31 + aTwinkle.x * 1.7) * 0.4;
        float twinkle = 1.0 + mix(0.3, 0.1, aMag) * tw;

        float sprite = 1.4 + aMag * aMag * 7.0;
        gl_PointSize = sprite * uDpr / w;
        vSprite = sprite;
        vI = (0.24 + 0.76 * aMag) * twinkle * env * uOpacity * uGain / w;
        vSpike = smoothstep(0.66, 0.96, aMag);

        // Young stars are blue and get warmer as they age; old ones are
        // yellow in the bulge and white in the disc. The star's own colour
        // is scattered on top.
        float temp = young
            ? mix(0.22, 0.5, age.x / age.y)
            : mix(0.82, 0.5, smoothstep(0.04, 0.42, r));
        temp += (aTemp - 0.5) * 0.3;
        temp = clamp(temp, 0.0, 1.0);
        vCol = temp < 0.5
            ? mix(uCool, uWhite, temp * 2.0)
            : mix(uWhite, uWarm, (temp - 0.5) * 2.0);
    }
`;

const STAR_FRAG = /* glsl */ `
    precision highp float;
    uniform float uHalo;
    varying vec3 vCol;
    varying float vI;
    varying float vSpike;
    varying float vSprite;

    void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        // A two-pixel sprite with a tight gaussian is one hard pixel, so the
        // core widens as the sprite shrinks.
        float k = mix(3.5, 10.0, clamp((vSprite - 2.0) / 10.0, 0.0, 1.0));
        float a = exp(-r2 * k) + exp(-r2 * 2.0) * uHalo;
        if (vSpike > 0.0) {
            // Faint diffraction spikes on the brightest few. Faint: the
            // moment they are obvious the sky is a screensaver.
            float sx = exp(-c.y * c.y * 160.0) * max(0.0, 1.0 - abs(c.x));
            float sy = exp(-c.x * c.x * 160.0) * max(0.0, 1.0 - abs(c.y));
            a += (sx + sy) * 0.26 * vSpike;
        }
        gl_FragColor = vec4(vCol, clamp(a * vI, 0.0, 1.0));
    }
`;

/** Foreground stars: fixed on the sky. */
const FIELD_VERT = /* glsl */ `
    uniform float uTime;
    uniform float uAspect;
    uniform float uDpr;
    uniform float uOpacity;
    uniform float uGain;
    uniform vec3 uCool;
    uniform vec3 uWhite;
    uniform vec3 uWarm;
    attribute float aMag;
    attribute float aTemp;
    attribute vec2 aTwinkle;
    varying vec3 vCol;
    varying float vI;
    varying float vSpike;
    varying float vSprite;
    void main() {
        gl_Position = vec4(position.x / uAspect, position.y, 0.999, 1.0);
        float tw = sin(uTime * aTwinkle.y + aTwinkle.x) * 0.6
                 + sin(uTime * aTwinkle.y * 2.31 + aTwinkle.x * 1.7) * 0.4;
        float twinkle = 1.0 + mix(0.25, 0.08, aMag) * tw;
        float sprite = 1.8 + aMag * aMag * 26.0;
        gl_PointSize = sprite * uDpr;
        vSprite = sprite;
        vI = (0.3 + 0.7 * aMag) * twinkle * uOpacity * uGain;
        vSpike = smoothstep(0.55, 0.9, aMag);
        vCol = aTemp < 0.5
            ? mix(uCool, uWhite, aTemp * 2.0)
            : mix(uWhite, uWarm, (aTemp - 0.5) * 2.0);
    }
`;

const QUAD_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

/** Bakes star density: the seeded field drawn soft, once. */
const BAKE_VERT = /* glsl */ `
    uniform sampler2D uPos;
    uniform float uTurn;
    uniform float uMinR;
    uniform float uMaxR;
    uniform float uSize;
    attribute vec2 aRef;
    varying float vKeep;
    void main() {
        vec2 p = texture2D(uPos, aRef).xy;
        float r = length(p);
        float c = cos(uTurn), s = sin(uTurn);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        gl_Position = vec4(p / ${EXTENT.toFixed(2)}, 0.0, 1.0);
        gl_PointSize = uSize;
        vKeep = step(uMinR, r) * step(r, uMaxR);
    }
`;
const BAKE_FRAG = /* glsl */ `
    precision highp float;
    uniform float uAlpha;
    varying float vKeep;
    void main() {
        if (vKeep < 0.5) discard;
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        gl_FragColor = vec4(vec3(exp(-r2 * 3.0) * uAlpha), 1.0);
    }
`;

/** The nebula, drawn each frame through the same view the stars use. */
const GLOW_VERT = /* glsl */ `
    uniform mat3 uView;
    uniform vec2 uCentre;
    uniform float uScale;
    uniform float uPersp;
    uniform float uAspect;
    uniform float uPattern;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        float c = cos(uPattern);
        float s = sin(uPattern);
        vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
        vec3 pv = uView * vec3(p, 0.0);
        float w = 1.0 - pv.z * uPersp;
        vec2 iso = uCentre * w + uScale * pv.xy;
        gl_Position = vec4(iso.x / uAspect, iso.y, 0.9999 * w, w);
    }
`;
const GLOW_FRAG = /* glsl */ `
    precision highp float;
    uniform sampler2D uLight;
    uniform sampler2D uDust;
    uniform float uOpacity;
    uniform float uGlow;
    varying vec2 vUv;
    void main() {
        float dens = texture2D(uLight, vUv).r;
        float dust = texture2D(uDust, vUv).r;
        vec2 p = (vUv * 2.0 - 1.0) * ${EXTENT.toFixed(2)};
        float r = length(p);
        // Saturating, so the arms are a haze and the core is a light.
        float lit = 1.0 - exp(-dens * 0.9);
        float core = 1.0 - exp(-dens * 0.12);
        vec3 haze = vec3(0.50, 0.60, 0.92);
        vec3 cream = vec3(1.0, 0.94, 0.82);
        vec3 brown = vec3(0.30, 0.17, 0.10);
        vec3 col = mix(haze, cream, core * core);
        // Dust darkens where the arms are only haze, never over the bulge.
        float lane = (1.0 - exp(-dust * 2.0)) * (1.0 - smoothstep(0.25, 0.7, core)) * smoothstep(0.08, 0.3, lit);
        col = mix(col, brown, lane * 0.9);
        float alpha = clamp(lit * 0.5 + core * 0.5 + lane * 0.45, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha * uGlow * uOpacity);
    }
`;

/** Full-screen, drawn first: the page's navy pulled toward black. */
const SCRIM_FRAG = /* glsl */ `
    precision highp float;
    uniform float uOpacity;
    uniform float uScrim;
    varying vec2 vUv;
    void main() {
        // A shade lighter toward the top left, so it is a sky and not a wall.
        float g = 1.0 - 0.12 * smoothstep(0.0, 1.0, (vUv.y + (1.0 - vUv.x)) * 0.5);
        gl_FragColor = vec4(vec3(0.01, 0.015, 0.045) * g, uScrim * uOpacity);
    }
`;

function gaussianJs(): number {
    const u = Math.max(1e-6, Math.random());
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function circularSpeedJs(r: number): number {
    return (V0 * r) / Math.sqrt(r * r + CORE_RADIUS * CORE_RADIUS);
}

/** The initial star: position and velocity. Mirrors the GLSL `seed`. */
function seedJs(out: Float32Array, offset: number, young: boolean): void {
    const u = Math.random();
    const th = Math.random() * Math.PI * 2;
    let x: number, y: number;
    if (young) {
        const r = 0.12 + 0.95 * Math.pow(u, 0.8);
        const arm = Math.floor(Math.random() * ARMS) * ((Math.PI * 2) / ARMS);
        const across = gaussianJs() * (0.015 + 0.05 * r);
        const ang = arm + (SPIRAL_K / ARMS) * Math.log(r / SPIRAL_R0) + across / r;
        x = Math.cos(ang) * r; y = Math.sin(ang) * r;
    } else if (Math.random() < 0.22) {
        const r = Math.abs(gaussianJs()) * 0.07;
        x = Math.cos(th) * r; y = Math.sin(th) * r;
    } else {
        const r = -0.4 * Math.log(1 - u * 0.936);
        x = Math.cos(th) * r; y = Math.sin(th) * r;
    }
    const r = Math.max(Math.hypot(x, y), 1e-4);
    const vc = circularSpeedJs(r) * (1 + DISPERSION * gaussianJs());
    out[offset] = x;
    out[offset + 1] = y;
    out[offset + 2] = (y / r) * vc + gaussianJs() * DISPERSION * V0;
    out[offset + 3] = (-x / r) * vc + gaussianJs() * DISPERSION * V0;
}

function viewMatrix(): THREE.Matrix3 {
    const rx = new THREE.Matrix4().makeRotationX(-TILT);
    const rz = new THREE.Matrix4().makeRotationZ(ROLL);
    return new THREE.Matrix3().setFromMatrix4(rz.multiply(rx));
}

function makeTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(BAKE_SIZE, BAKE_SIZE, {
        type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false
    });
}

export function createGalaxy(renderer: THREE.WebGLRenderer): Galaxy {
    const group = new THREE.Group();
    const view = viewMatrix();

    // Fewer stars on a phone. Everything scales with this one number.
    const size = window.innerWidth < 800 ? 160 : 256;
    const count = size * size;

    // --- The initial field
    const seedTexture = new THREE.DataTexture(new Float32Array(count * 4), size, size, THREE.RGBAFormat, THREE.FloatType);
    const seedData = seedTexture.image.data as Float32Array;
    const ageData = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        const young = Math.random() < YOUNG_SHARE;
        seedJs(seedData, i * 4, young);
        if (young) {
            // Lives already under way, so nothing is born or dies in unison.
            const life = LIFE_MIN + LIFE_SPAN * Math.random();
            ageData[i * 4] = Math.random() * life;
            ageData[i * 4 + 1] = life;
        }
    }
    seedTexture.minFilter = THREE.NearestFilter;
    seedTexture.magFilter = THREE.NearestFilter;
    seedTexture.needsUpdate = true;

    // --- The dynamics, integrated on the GPU
    const gpu = new GPUComputationRenderer(size, size, renderer);
    if (!renderer.extensions.has('EXT_color_buffer_float')) gpu.setDataType(THREE.HalfFloatType);
    const initial = gpu.createTexture();
    (initial.image.data as Float32Array).set(seedData);
    const initialAge = gpu.createTexture();
    (initialAge.image.data as Float32Array).set(ageData);
    const posVar: Variable = gpu.addVariable('texPos', COMPUTE_FRAG, initial);
    const ageVar: Variable = gpu.addVariable('texAge', AGE_FRAG, initialAge);
    gpu.setVariableDependencies(posVar, [posVar, ageVar]);
    gpu.setVariableDependencies(ageVar, [ageVar]);
    const computeUniforms = posVar.material.uniforms as Record<string, THREE.IUniform>;
    computeUniforms.uTime = { value: 0 };
    computeUniforms.uDt = { value: 0 };
    computeUniforms.uPattern = { value: 0 };
    const ageUniforms = ageVar.material.uniforms as Record<string, THREE.IUniform>;
    ageUniforms.uTime = computeUniforms.uTime;
    ageUniforms.uDt = computeUniforms.uDt;
    const initError = gpu.init();
    if (initError) console.error('galaxy: compute init failed', initError);

    // --- Per-star attributes
    const refs = new Float32Array(count * 2);
    const mag = new Float32Array(count);
    const temp = new Float32Array(count);
    const zs = new Float32Array(count);
    const twinkle = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        refs[i * 2] = ((i % size) + 0.5) / size;
        refs[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
        // Steep power law: a galaxy is mostly faint.
        mag[i] = Math.pow(Math.random(), 2.8);
        temp[i] = Math.random();
        zs[i] = gaussianJs();
        twinkle[i * 2] = Math.random() * Math.PI * 2;
        twinkle[i * 2 + 1] = 0.5 + Math.random() * 1.5;
    }
    const refAttr = new THREE.BufferAttribute(refs, 2);
    const starGeo = new THREE.BufferGeometry();
    // Never read: the shader takes its position from the textures, but
    // three needs a position attribute to know how many points to draw.
    starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    starGeo.setAttribute('aRef', refAttr);
    starGeo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    starGeo.setAttribute('aTemp', new THREE.BufferAttribute(temp, 1));
    starGeo.setAttribute('aZ', new THREE.BufferAttribute(zs, 1));
    starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 2));
    starGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

    // --- The bakes: light and dust
    function bake(turn: number, minR: number, maxR: number, sizePx: number, alpha: number): THREE.Texture {
        const target = makeTarget(renderer);
        const scene = new THREE.Scene();
        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const mat = new THREE.ShaderMaterial({
            vertexShader: BAKE_VERT,
            fragmentShader: BAKE_FRAG,
            uniforms: {
                uPos: { value: seedTexture },
                uTurn: { value: turn },
                uMinR: { value: minR },
                uMaxR: { value: maxR },
                uSize: { value: sizePx },
                uAlpha: { value: alpha }
            },
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        geo.setAttribute('aRef', refAttr);
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        scene.add(pts);
        const previous = renderer.getRenderTarget();
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scene, cam);
        renderer.setRenderTarget(previous);
        geo.dispose();
        mat.dispose();
        return target.texture;
    }
    const lightTex = bake(0, 0, 2, 16, 0.012);
    const dustTex = bake(DUST_TURN, 0.18, 0.85, 14, 0.012);

    // --- Stars
    const starUniforms = {
        uPos: { value: null as THREE.Texture | null },
        uAge: { value: null as THREE.Texture | null },
        uView: { value: view },
        uCentre: { value: CENTRE },
        uScale: { value: SCALE },
        uPersp: { value: PERSPECTIVE },
        uAspect: { value: 1 },
        uDpr: { value: renderer.getPixelRatio() },
        uTime: { value: 0 },
        uPattern: { value: 0 },
        uOpacity: { value: 0 },
        uGain: { value: 0.72 },
        uHalo: { value: 0.3 },
        uCool: { value: new THREE.Color(0.7, 0.8, 1.0) },
        uWhite: { value: new THREE.Color(1, 1, 1) },
        uWarm: { value: new THREE.Color(1.0, 0.8, 0.58) }
    };
    const starMat = new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: starUniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.frustumCulled = false;
    stars.renderOrder = -1;

    // --- Glow
    const glowUniforms = {
        uLight: { value: lightTex },
        uDust: { value: dustTex },
        uView: { value: view },
        uCentre: { value: CENTRE },
        uScale: { value: SCALE },
        uPersp: { value: PERSPECTIVE },
        uAspect: { value: 1 },
        uPattern: { value: 0 },
        uOpacity: { value: 0 },
        uGlow: { value: 1.0 }
    };
    const glowMat = new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: glowUniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    // Subdivided so the perspective-correct interpolation has something to
    // work with across the tilt.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, 8, 8), glowMat);
    glow.frustumCulled = false;
    glow.renderOrder = -2;

    // --- Scrim
    const scrimUniforms = { uOpacity: { value: 0 }, uScrim: { value: SCRIM } };
    const scrimMat = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: SCRIM_FRAG,
        uniforms: scrimUniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    const scrim = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scrimMat);
    scrim.frustumCulled = false;
    scrim.renderOrder = -3;

    // --- Foreground stars
    const fieldPos = new Float32Array(FIELD_COUNT * 3);
    const fieldMag = new Float32Array(FIELD_COUNT);
    const fieldTemp = new Float32Array(FIELD_COUNT);
    const fieldTwinkle = new Float32Array(FIELD_COUNT * 2);
    for (let i = 0; i < FIELD_COUNT; i++) {
        // Wider than any viewport.
        fieldPos[i * 3] = (Math.random() * 2 - 1) * 2.7;
        fieldPos[i * 3 + 1] = (Math.random() * 2 - 1) * 1.05;
        fieldPos[i * 3 + 2] = 0;
        fieldMag[i] = Math.pow(Math.random(), 2.2);
        let t = 0.4 + gaussianJs() * 0.18;
        if (Math.random() < 0.12) t = 0.8 + Math.random() * 0.2;
        fieldTemp[i] = Math.min(1, Math.max(0, t));
        fieldTwinkle[i * 2] = Math.random() * Math.PI * 2;
        fieldTwinkle[i * 2 + 1] = 0.4 + Math.random() * 1.2;
    }
    const fieldGeo = new THREE.BufferGeometry();
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(fieldPos, 3));
    fieldGeo.setAttribute('aMag', new THREE.BufferAttribute(fieldMag, 1));
    fieldGeo.setAttribute('aTemp', new THREE.BufferAttribute(fieldTemp, 1));
    fieldGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(fieldTwinkle, 2));
    fieldGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    const fieldUniforms = {
        uTime: starUniforms.uTime,
        uAspect: starUniforms.uAspect,
        uDpr: starUniforms.uDpr,
        uOpacity: starUniforms.uOpacity,
        uGain: { value: 1 },
        uHalo: starUniforms.uHalo,
        uCool: starUniforms.uCool,
        uWhite: starUniforms.uWhite,
        uWarm: starUniforms.uWarm
    };
    const fieldMat = new THREE.ShaderMaterial({
        vertexShader: FIELD_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: fieldUniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const field = new THREE.Points(fieldGeo, fieldMat);
    field.frustumCulled = false;
    field.renderOrder = 0;

    group.add(scrim);
    group.add(glow);
    group.add(stars);
    group.add(field);

    const startedAt = performance.now();
    let lastNow = startedAt;

    return {
        group,
        update(nowMs, aspect, opacity) {
            const visible = opacity > 0.002;
            group.visible = visible;
            // Capped so a tab that was in the background does not try to
            // integrate a minute in one step when it comes back.
            const dt = Math.min(0.05, Math.max(0, (nowMs - lastNow) * 0.001));
            lastNow = nowMs;
            if (!visible) return;

            const t = (nowMs - startedAt) * 0.001;
            const pattern = -t * PATTERN_OMEGA;

            computeUniforms.uTime.value = t;
            computeUniforms.uDt.value = dt;
            computeUniforms.uPattern.value = pattern;
            gpu.compute();
            starUniforms.uPos.value = gpu.getCurrentRenderTarget(posVar).texture;
            starUniforms.uAge.value = gpu.getCurrentRenderTarget(ageVar).texture;

            starUniforms.uTime.value = t;
            starUniforms.uPattern.value = pattern;
            starUniforms.uAspect.value = aspect;
            starUniforms.uDpr.value = renderer.getPixelRatio();
            starUniforms.uOpacity.value = opacity;
            glowUniforms.uAspect.value = aspect;
            glowUniforms.uPattern.value = pattern;
            glowUniforms.uOpacity.value = opacity;
            scrimUniforms.uOpacity.value = opacity;
        },
        setPalette({ light, ink }) {
            if (light) {
                const inkCol = new THREE.Color(ink);
                starMat.blending = THREE.NormalBlending;
                fieldMat.blending = THREE.NormalBlending;
                starUniforms.uWhite.value.copy(inkCol);
                starUniforms.uCool.value.copy(inkCol).lerp(new THREE.Color(0x0f172a), 0.5);
                starUniforms.uWarm.value.copy(inkCol).lerp(new THREE.Color(0x7c2d12), 0.5);
                starUniforms.uHalo.value = 0.05;
                starUniforms.uGain.value = 0.9;
                glow.visible = false;
                scrim.visible = false;
            } else {
                starMat.blending = THREE.AdditiveBlending;
                fieldMat.blending = THREE.AdditiveBlending;
                starUniforms.uWhite.value.setRGB(1, 1, 1);
                starUniforms.uCool.value.setRGB(0.7, 0.8, 1.0);
                starUniforms.uWarm.value.setRGB(1.0, 0.8, 0.58);
                starUniforms.uHalo.value = 0.3;
                starUniforms.uGain.value = 0.72;
                glow.visible = true;
                scrim.visible = true;
            }
            starMat.needsUpdate = true;
            fieldMat.needsUpdate = true;
        },
        dispose() {
            gpu.dispose();
            seedTexture.dispose();
            lightTex.dispose();
            dustTex.dispose();
            starGeo.dispose();
            starMat.dispose();
            glow.geometry.dispose();
            glowMat.dispose();
            scrim.geometry.dispose();
            scrimMat.dispose();
            fieldGeo.dispose();
            fieldMat.dispose();
        }
    };
}
