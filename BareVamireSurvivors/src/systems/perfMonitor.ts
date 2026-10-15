// Measures where frame time goes. The engine has no built-in profiler, so this wraps the
// engine's per-frame entry points (bare.FixedUpdate / Update / Render) and the arcade
// physics controller's FixedUpdate. CPU time only: GPU work shows up in the frame interval.

export type PerfStats = {
    fps: number;
    frameMs: number;   // average time between frames
    worstMs: number;   // slowest frame in the window
    p95Ms: number;
    fixedMs: number;   // all fixed steps of a frame, physics included
    physicsMs: number; // arcade physics share of fixedMs
    updateMs: number;
    renderMs: number;  // building and submitting draw calls
    steps: number;     // fixed steps per frame
    drawCalls: number;
    heapMB: number;
};

type Accumulator = {
    frames: number;
    interval: number;
    intervals: number[];
    fixed: number;
    physics: number;
    update: number;
    render: number;
    steps: number;
    drawCalls: number;
};

const NewAccumulator = (): Accumulator => ({
    frames: 0, interval: 0, intervals: [], fixed: 0, physics: 0, update: 0, render: 0, steps: 0, drawCalls: 0,
});

export class PerfMonitor
{
    display: PerfStats = PerfMonitor.Summarize(NewAccumulator());
    // Frame intervals in ms, a ring buffer for the HUD graph
    readonly history = new Float32Array(240);
    historyIndex = 0;

    private installedOn: object | null = null;
    private frame = { fixed: 0, physics: 0, update: 0, render: 0, steps: 0 };
    private lastFrameTime = 0;
    private window = NewAccumulator();
    private windowStart = 0;
    private sample: Accumulator | null = null;

    Install()
    {
        if (this.installedOn === bare)
            return;

        this.installedOn = bare;

        const fixedUpdate = bare.FixedUpdate.bind(bare);
        bare.FixedUpdate = (dt: number) => {
            const t0 = performance.now();
            fixedUpdate(dt);
            this.frame.fixed += performance.now() - t0;
            this.frame.steps++;
        };

        const update = bare.Update.bind(bare);
        bare.Update = (dt: number) => {
            const t0 = performance.now();
            update(dt);
            this.frame.update += performance.now() - t0;
        };

        const render = bare.Render.bind(bare);
        bare.Render = () => {
            const t0 = performance.now();
            render();
            this.frame.render += performance.now() - t0;
            this.EndFrame();
        };
    }

    // The physics controller belongs to a scene, so this is called again for each new game scene
    WatchPhysics(controller: { FixedUpdate(dt: number): void })
    {
        const fixedUpdate = controller.FixedUpdate.bind(controller);
        controller.FixedUpdate = (dt: number) => {
            const t0 = performance.now();
            fixedUpdate(dt);
            this.frame.physics += performance.now() - t0;
        };
    }

    BeginSample()
    {
        this.sample = NewAccumulator();
    }

    EndSample(): PerfStats
    {
        const stats = PerfMonitor.Summarize(this.sample ?? NewAccumulator());
        this.sample = null;
        return stats;
    }

    private EndFrame()
    {
        const now = performance.now();
        const interval = this.lastFrameTime ? now - this.lastFrameTime : 16.7;
        this.lastFrameTime = now;

        this.history[this.historyIndex] = interval;
        this.historyIndex = (this.historyIndex + 1) % this.history.length;

        this.Accumulate(this.window, interval);
        if (this.sample)
            this.Accumulate(this.sample, interval);

        const f = this.frame;
        f.fixed = f.physics = f.update = f.render = f.steps = 0;

        if (now - this.windowStart >= 500)
        {
            this.display = PerfMonitor.Summarize(this.window);
            this.window = NewAccumulator();
            this.windowStart = now;
        }
    }

    private Accumulate(acc: Accumulator, interval: number)
    {
        const f = this.frame;
        acc.frames++;
        acc.interval += interval;
        acc.intervals.push(interval);
        acc.fixed += f.fixed;
        acc.physics += f.physics;
        acc.update += f.update;
        acc.render += f.render;
        acc.steps += f.steps;
        acc.drawCalls += rapid.drawcallCount;
    }

    private static Summarize(acc: Accumulator): PerfStats
    {
        const n = Math.max(1, acc.frames);
        const sorted = acc.intervals.slice().sort((a, b) => a - b);
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;

        return {
            fps: acc.interval > 0 ? 1000 * acc.frames / acc.interval : 0,
            frameMs: acc.interval / n,
            worstMs: sorted[sorted.length - 1] ?? 0,
            p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            fixedMs: acc.fixed / n,
            physicsMs: acc.physics / n,
            updateMs: acc.update / n,
            renderMs: acc.render / n,
            steps: acc.steps / n,
            drawCalls: acc.drawCalls / n,
            heapMB: memory ? memory.usedJSHeapSize / 1048576 : 0,
        };
    }
}

export const perf = new PerfMonitor();
