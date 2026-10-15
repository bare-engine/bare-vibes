// Deterministic random numbers and noise for the simulation. The sim never uses Math.random,
// so a save plus its rng state replays the same way.

export class Rng
{
    state: number;

    constructor(seed: number)
    {
        this.state = seed | 0;
    }

    // mulberry32
    Next(): number
    {
        let t = (this.state = (this.state + 0x6D2B79F5) | 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    Int(max: number): number
    {
        return Math.floor(this.Next() * max);
    }

    Range(min: number, max: number): number
    {
        return min + this.Next() * (max - min);
    }
}

// a stable 0..1 value per grid cell, used for tile variants and worldgen sprinkles
export function Hash2(x: number, y: number, seed: number): number
{
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export class ValueNoise
{
    constructor(private seed: number) {}

    private Smooth(t: number): number
    {
        return t * t * (3 - 2 * t);
    }

    Get(x: number, y: number): number
    {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const tx = this.Smooth(x - x0), ty = this.Smooth(y - y0);
        const a = Hash2(x0, y0, this.seed), b = Hash2(x0 + 1, y0, this.seed);
        const c = Hash2(x0, y0 + 1, this.seed), d = Hash2(x0 + 1, y0 + 1, this.seed);
        const top = a + (b - a) * tx;
        const bottom = c + (d - c) * tx;
        return top + (bottom - top) * ty;
    }

    // fractal noise, roughly 0..1
    Fbm(x: number, y: number, octaves = 4): number
    {
        let sum = 0, amp = 0.5, freq = 1, norm = 0;
        for (let i = 0; i < octaves; i++)
        {
            sum += this.Get(x * freq, y * freq) * amp;
            norm += amp;
            amp *= 0.5;
            freq *= 2;
        }
        return sum / norm;
    }
}
