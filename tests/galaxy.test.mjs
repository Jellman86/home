import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Use the project's compiler so tests also run on the deployment's Node 20.
const source = await readFile(new URL('../src/lib/galaxy-model.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { advanceClock, galaxyLayout, seededRandom, STEP, MAX_STEPS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

for (const fps of [30, 60, 120, 144]) {
    test(`one simulation second is identical at ${fps} FPS`, () => {
        let accumulator = 0, steps = 0;
        for (let i = 0; i < fps; i++) {
            const next = advanceClock(accumulator, 1 / fps, true);
            accumulator = next.remainder;
            steps += next.steps;
        }
        assert.equal(steps, 60);
        assert.ok(accumulator < 1e-8);
    });
}

test('hidden, reduced-motion and resumed tabs do not accumulate catch-up time', () => {
    assert.deepEqual(advanceClock(STEP / 2, 60, false), { steps: 0, remainder: 0 });
    assert.deepEqual(advanceClock(STEP / 2, 60, true), { steps: 0, remainder: 0 });
    assert.equal(advanceClock(0, STEP, true).steps, 1);
});

test('slow frames have a bounded integration budget', () => {
    const next = advanceClock(0, 0.2, true);
    assert.equal(next.steps, MAX_STEPS);
    assert.ok(next.remainder < STEP);
    assert.equal(advanceClock(0, -1, true).steps, 0);
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [800, 600], [1280, 720], [1920, 1080]]) {
    test(`galaxy core stays onscreen at ${width}×${height}`, () => {
        const layout = galaxyLayout(width, height, { top: 190, left: 16, right: width - 16, bottom: height });
        assert.ok(Math.abs(layout.x) < width / height);
        assert.ok(Math.abs(layout.y) < 1);
        assert.ok(layout.scale > 0 && Number.isFinite(layout.scale));
        if (width < 800) {
            const radius = layout.scale * height / 2;
            assert.ok(radius <= 95);
        }
    });
}

test('minimising opens a centred viewing mode and dragging is bounded', () => {
    const expanded = galaxyLayout(1280, 900, { top: 800, bottom: 842, left: 0, right: 1200 });
    assert.equal(expanded.x, 0);
    assert.equal(expanded.y, 0.1);
    for (const top of [-10000, 10000]) {
        const layout = galaxyLayout(1280, 900, { top, bottom: top + 600, left: 0, right: 1200 });
        assert.ok(layout.y > -1 && layout.y < 1);
    }
});

test('seeded fields are repeatable, distributed, and accept independent seeds', () => {
    const a = seededRandom(), b = seededRandom(), c = seededRandom(42);
    const values = Array.from({ length: 1000 }, () => a());
    assert.deepEqual(values, Array.from({ length: 1000 }, () => b()));
    assert.ok(values.every(v => v >= 0 && v < 1));
    assert.ok(new Set(values).size > 990);
    assert.notEqual(values[0], c());
});
