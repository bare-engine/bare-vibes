const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { bareTypeScriptTransformPlugin } = require('../vite/plugins.cjs');

const engineRoot = path.resolve(__dirname, '..');
const reference = '__bareControllerRef_ParticleController';

async function withProject(source, run) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bare-controller-'));
    try {
        const files = {
            'tsconfig.json': JSON.stringify({ compilerOptions: {
                target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler',
                experimentalDecorators: true, skipLibCheck: true,
                paths: { 'bare-engine': [path.join(engineRoot, 'src/index.ts')] }
            }, include: ['src'] }),
            'src/game.ts': source,
            // Resolve types against the actual engine above. At runtime these small modules
            // isolate the registration contract without importing WebGL/browser startup.
            'runtime/index.ts': `export { Scene } from './scene'; export { ParticleController } from './particle';`,
            'runtime/scene.ts': `export class Scene { get particle() { return globalThis.__particleProvider && new globalThis.__particleProvider(); } }`,
            'runtime/particle.ts': `export class ParticleController { OneShot() { globalThis.__shots = (globalThis.__shots || 0) + 1; } }
                globalThis.__particleProvider = ParticleController;`
        };
        for (const [file, content] of Object.entries(files)) {
            const target = path.join(root, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, content);
        }
        await run(root);
    } finally {
        // Only remove this test's freshly created temporary project.
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    }
}

async function productionProbe(source, included) {
    await withProject(source, async root => {
        const plugin = bareTypeScriptTransformPlugin({ projectRoot: root, useTypeChecker: false, hotRestart: false });
        const entry = path.join(root, 'src/game.ts').replace(/\\/g, '/');
        const transformed = plugin.transform(source, entry);
        assert.equal(transformed.code.includes(reference), included, 'typed source transform');
        const { build } = await import('vite');
        const result = await build({
            configFile: false, root, logLevel: 'silent',
            resolve: { alias: { 'bare-engine': path.join(root, 'runtime/index.ts') } },
            plugins: [plugin],
            build: {
                write: false, minify: true,
                lib: { entry: path.join(root, 'src/game.ts'), formats: ['iife'], name: 'ControllerProbe' },
                rollupOptions: { treeshake: { moduleSideEffects: false } }
            }
        });
        const context = {};
        const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
        vm.runInNewContext(outputs.find(item => item.type === 'chunk').code, context);
        assert.equal(reference in context, included);
        assert.equal(context.__probe, true);
        assert.equal(context.__shots || 0, included ? 1 : 0);
    });
}

test('production retains controllers used only by a standalone helper', async () => {
    await productionProbe(`import { Scene } from 'bare-engine';
        function Burst(host: Scene) { host.particle.OneShot(null); }
        Burst(new Scene()); globalThis.__probe = true;`, true);
});

test('production retains controllers used by class methods', async () => {
    await productionProbe(`import { Scene } from 'bare-engine';
        class Effects { static Burst(host: Scene) { host.particle.OneShot(null); } }
        Effects.Burst(new Scene()); globalThis.__probe = true;`, true);
});

test('production recognizes inferred aliases and callback parameters', async () => {
    await productionProbe(`import { Scene } from 'bare-engine';
        function Burst(host: Scene) { const renamed = host; [renamed].forEach(value => value.particle.OneShot(null)); }
        Burst(new Scene()); globalThis.__probe = true;`, true);
});

test('production recognizes an aliased Scene import and subclasses', async () => {
    await productionProbe(`import { Scene as Base } from 'bare-engine';
        class Derived extends Base { Burst() { this.particle.OneShot(null); } }
        new Derived().Burst(); globalThis.__probe = true;`, true);
});

test('production leaves optional controller access tree-shakeable', async () => {
    await productionProbe(`import { Scene } from 'bare-engine';
        function Burst(host: Scene | undefined) { host?.particle?.OneShot(null); }
        Burst(new Scene()); globalThis.__probe = true;`, false);
});

test('production does not infer scene ownership from variable names or any', async () => {
    await productionProbe(`const uiScene = { particle: { OneShot() { globalThis.__probe = true; } } };
        const gameScene: any = uiScene;
        uiScene.particle.OneShot(); gameScene.particle.OneShot();`, false);
});

test('controller type analysis is refreshed on source changes', async () => {
    await withProject(`const uiScene = { particle: { OneShot() {} } }; uiScene.particle.OneShot();`, async root => {
        const plugin = bareTypeScriptTransformPlugin({ projectRoot: root, useTypeChecker: false, hotRestart: false });
        const file = path.join(root, 'src/game.ts').replace(/\\/g, '/');
        assert.ok(!plugin.transform(fs.readFileSync(file, 'utf8'), file).code.includes(reference));
        const updated = `import { Scene } from 'bare-engine'; function Burst(host: Scene) { host.particle.OneShot(null); }`;
        fs.writeFileSync(file, updated);
        plugin.handleHotUpdate();
        assert.ok(plugin.transform(updated, file).code.includes(reference));
    });
});
