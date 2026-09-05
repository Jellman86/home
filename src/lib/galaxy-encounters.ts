/** Tiny, illustrative discoveries, composited in linear light before output. */
export const ENCOUNTER_GLSL = /* glsl */ `
    void addDistantGalaxies(inout vec4 light, vec2 uv, vec2 viewport) {
        // Three barely resolved galaxies: fixed, soft, and much fainter than
        // foreground stars. No new geometry or render pass is needed.
        for (int i = 0; i < 3; i++) {
            vec2 centre = i == 0 ? vec2(0.12, 0.74) : (i == 1 ? vec2(0.89, 0.47) : vec2(0.26, 0.14));
            vec2 p = (uv - centre) * viewport;
            if (dot(p, p) > 1600.0) continue;
            float angle = float(i) * 1.7 + 0.6;
            p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
            float disc = exp(-dot(p / vec2(15.0, 3.5), p / vec2(15.0, 3.5)));
            float core = exp(-dot(p, p) / 9.0);
            float glow = disc * 0.018 + core * 0.022;
            light.rgb += vec3(0.75, 0.65, 0.55) * glow;
            light.a = max(light.a, glow * 3.0);
        }
    }

    void applyEncounter(inout vec4 light, vec2 uv) {
        // xy: screen UV, z: opacity envelope, w: 1=ship / 2=black hole.
        if (uEncounter.z <= 0.0) return;
        vec2 delta = (uv - uEncounter.xy) * uViewport;
        float size = uEncounterStyle.x;
        float fade = uEncounter.z;
        float reach = uEncounterStyle.z;
        if (dot(delta, delta) > reach * reach) return;

        if (uEncounter.w > 1.5) {
            float r = length(delta);
            // A local illustrative lens: bend actual stellar light, not the UI.
            // The lens has its own reach: a tiny silhouette can distort a much
            // wider patch of sky. Taper to zero at the local effect boundary.
            float einsteinRadius = size * 3.0;
            float lens = einsteinRadius * einsteinRadius / max(r, size * 1.8)
                       * exp(-r * r / (reach * reach * 0.42))
                       * (1.0 - smoothstep(reach * 0.7, reach, r));
            vec2 warpedUV = clamp(uv - delta / max(r, 0.01) * lens / uViewport, vec2(0.001), vec2(0.999));
            vec4 warped = texture2D(uScene, warpedUV);
            warped.a = clamp(warped.a, 0.0, 1.0);
            light = mix(light, warped, fade);
            float horizon = (1.0 - smoothstep(size * 0.7, size * 0.88, r)) * fade;
            light.rgb = mix(light.rgb, vec3(0.0004, 0.0006, 0.0014), horizon);
            light.a = mix(light.a, 1.0, horizon);
            float ring = exp(-pow((r - size * 1.10) / (size * 0.09), 2.0));
            vec2 tilted = mat2(0.94, -0.34, 0.34, 0.94) * delta;
            float diskRadius = length(tilted * vec2(1.0, 3.3));
            float disk = exp(-pow((diskRadius - size * 1.65) / (size * 0.20), 2.0));
            disk *= smoothstep(-size * 0.15, size * 0.1, tilted.y) + 0.25;
            vec3 glow = vec3(0.46, 0.63, 0.85) * ring * 0.15 + vec3(1.0, 0.52, 0.20) * disk * 0.30;
            light.rgb += glow * fade;
            light.a = max(light.a, clamp((ring + disk) * fade * 0.65, 0.0, 1.0));
        } else {
            float c = cos(uEncounterStyle.y), s = sin(uEncounterStyle.y);
            vec2 p = vec2(c * delta.x + s * delta.y, -s * delta.x + c * delta.y) / size;
            // A small swept-wing silhouette with twin steady drive lights.
            float edge = max(abs(p.y) - (1.0 - p.x) * 0.38, -p.x - 0.75);
            float body = (1.0 - smoothstep(0.0, 0.055, edge)) * fade;
            float notch = (1.0 - smoothstep(-0.6, -0.05, p.x)) * (1.0 - smoothstep(0.07, 0.17, abs(p.y)));
            body *= 1.0 - notch;
            light.rgb = mix(light.rgb, vec3(0.009, 0.016, 0.025), body * 0.85);
            light.a = mix(light.a, 1.0, body * 0.85);
            float rim = exp(-abs(edge) * 48.0) * 0.08;
            float engines = exp(-dot(p - vec2(-0.60, 0.32), p - vec2(-0.60, 0.32)) * 120.0)
                          + exp(-dot(p - vec2(-0.60, -0.32), p - vec2(-0.60, -0.32)) * 120.0);
            float exhaust = exp(-pow((abs(p.y) - 0.32) * 12.0, 2.0)) * exp(min(0.0, p.x + 0.65) * 2.8) * (1.0 - smoothstep(-0.65, -0.5, p.x));
            float cockpit = exp(-dot(p - vec2(0.15, 0.0), p - vec2(0.15, 0.0)) * 70.0);
            float emission = rim + engines * 1.2 + exhaust * 0.15 + cockpit * 0.1;
            light.rgb += vec3(0.24, 0.72, 0.78) * emission * fade;
            light.a = max(light.a, clamp(emission * fade * 1.5, 0.0, 1.0));
        }
    }
`;
