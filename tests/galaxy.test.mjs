import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Use the project's compiler so tests also run on the deployment's Node 20.
const source = await readFile(new URL('../src/lib/galaxy-model.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { advanceClock, galaxyLayout, seededRandom, createEncounterDirector, encounterPose, STEP, MAX_STEPS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

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
        const layout = galaxyLayout(width, height);
        assert.ok(Math.abs(layout.x) < width / height);
        assert.ok(Math.abs(layout.y) < 1);
        assert.ok(layout.scale > 0 && Number.isFinite(layout.scale));
        if (width < 800) {
            const radius = layout.scale * height / 2;
            assert.ok(Math.abs(radius - width * 0.43) < 1e-8);
        }
    });
}

test('dragging, scrolling and minimising cannot reframe the fixed galaxy', () => {
    const fixed = galaxyLayout(1280, 900);
    assert.equal(fixed.scale, 0.98);
    // Deliberately supply the legacy panel argument: it must have no effect.
    for (const panel of [{ top: 200, bottom: 800 }, { top: 800, bottom: 842 }, { top: -10000, bottom: -9400 }]) {
        assert.deepEqual(galaxyLayout(1280, 900, panel), fixed);
    }
});

test('encounters start after a quiet period and never catch up a suspended tab', () => {
    const director = createEncounterDirector(() => 0);
    for (let i = 0; i < 179; i++) assert.equal(director.update(0.25, true), null);
    const before = director.status();
    assert.equal(director.update(3600, true), null);
    assert.deepEqual(director.status(), before);
    assert.equal(director.update(0.25, true).kind, 'ship');
});

test('hidden, light and reduced-motion skies pause encounters without starting one', () => {
    const director = createEncounterDirector(() => 0);
    const initial = director.status();
    for (let i = 0; i < 1000; i++) assert.equal(director.update(0.25, false), null);
    assert.deepEqual(director.status(), initial);
    for (let i = 0; i < 184; i++) director.update(0.25, true);
    const active = director.status();
    assert.equal(active.kind, 'ship');
    assert.equal(director.update(0.25, false), null);
    assert.deepEqual(director.status(), active);
});

test('each encounter ends before a minimum two-minute quiet gap', () => {
    const director = createEncounterDirector(() => 0);
    for (let i = 0; i < 180 + 72; i++) director.update(0.25, true);
    assert.deepEqual(director.status(), { kind: null, age: 0, nextIn: 120 });
    for (let i = 0; i < 479; i++) assert.equal(director.update(0.25, true), null);
    assert.equal(director.update(0.25, true).kind, 'ship');
});

test('both encounter types occur sparsely across an hour of visible sky', () => {
    const director = createEncounterDirector(seededRandom(19));
    const kinds = new Set();
    let starts = 0, wasActive = false;
    for (let i = 0; i < 14400; i++) {
        const event = director.update(0.25, true);
        if (event && !wasActive) { starts++; kinds.add(event.kind); }
        wasActive = !!event;
    }
    assert.ok(starts >= 10 && starts <= 26);
    assert.deepEqual(kinds, new Set(['ship', 'black-hole']));
});

test('encounters fade smoothly at endpoints and have finite responsive paths', () => {
    for (const kind of ['ship', 'black-hole']) {
        for (const reverse of [true, false]) {
            for (const age of [0, 9, 18]) {
                const event = { kind, reverse, age, duration: 18, lane: 0.5 };
                const pose = encounterPose(event, 390, 844);
                assert.ok(Object.values(pose).every(Number.isFinite));
                assert.ok(pose.x >= 0.04 && pose.x <= 0.91 && pose.y > 0 && pose.y < 1);
                assert.equal(pose.opacity, age === 9 ? 1 : 0);
            }
        }
    }
});

test('black holes begin in the margin and approach slowly with a small horizon', () => {
    for (const [width, height] of [[390, 844], [1280, 900]]) {
        const event = { kind: 'black-hole', age: 0, duration: 72, lane: 0.5, reverse: false };
        const start = encounterPose(event, width, height);
        const next = encounterPose({ ...event, age: 1 }, width, height);
        const end = encounterPose({ ...event, age: 72 }, width, height);
        assert.ok(start.x < 0.05);
        assert.ok(Math.abs(next.x - start.x) * width < 5);
        assert.ok(end.size <= 6 && start.size < end.size);
        assert.ok(start.reach >= start.size * 10);
        assert.ok(end.x < 0.3);
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
