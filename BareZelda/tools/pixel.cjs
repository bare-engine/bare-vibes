// SMALL PIXEL CANVAS USED BY THE ART AND MAP GENERATORS.
// COLORS ARE [r, g, b, a] ARRAYS. A PALETTE MAPS SINGLE CHARACTERS TO HEX COLORS FOR ASCII SPRITES.

const sharp = require('sharp');

const PALETTE = {
    k: '#1a1c2c', // OUTLINE
    w: '#f4f4f4',
    i: '#94b0c2',
    m: '#566c86',
    d: '#333c57',
    r: '#b13e53',
    o: '#ef7d57',
    y: '#ffcd75',
    l: '#a7f070',
    g: '#38b764',
    e: '#1f6b45',
    t: '#257179',
    n: '#29366f',
    b: '#3b5dc9',
    c: '#41a6f6',
    a: '#73eff7',
    p: '#5d275d',
    v: '#9a5bc0',
    s: '#f6c6a0',
    z: '#c98a5e',
    u: '#9a6438',
    x: '#5e3c22',
    q: '#d9a066',
    h: '#f0d8a0',
    f: '#ff8fb0',
};

function hex(color)
{
    if (Array.isArray(color))
        return color;
    if (color in PALETTE)
        color = PALETTE[color];
    const v = color.replace('#', '');
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), v.length > 6 ? parseInt(v.slice(6, 8), 16) : 255];
}

function shade(color, f)
{
    const c = hex(color);
    return [Math.max(0, Math.min(255, Math.round(c[0] * f))), Math.max(0, Math.min(255, Math.round(c[1] * f))), Math.max(0, Math.min(255, Math.round(c[2] * f))), c[3]];
}

// DETERMINISTIC RANDOM, SO GENERATED ART AND MAPS ARE THE SAME ON EVERY RUN
function rng(seed)
{
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

class Pix
{
    constructor(w, h)
    {
        this.w = w;
        this.h = h;
        this.data = new Uint8ClampedArray(w * h * 4);
    }

    static fromAscii(rows, colors = {})
    {
        const h = rows.length;
        const w = rows[0].length;
        const p = new Pix(w, h);
        rows.forEach((row, y) => {
            if (row.length != w)
                throw new Error(`ASCII row ${y} is ${row.length} wide, expected ${w}: "${row}"`);
            for (let x = 0; x < w; x++)
            {
                const ch = row[x];
                if (ch == '.' || ch == ' ')
                    continue;
                const col = colors[ch] ?? ch;
                if (!(col in PALETTE) && !String(col).startsWith('#'))
                    throw new Error(`Unknown color "${ch}" in row ${y}`);
                p.set(x, y, col);
            }
        });
        return p;
    }

    get(x, y)
    {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h)
            return [0, 0, 0, 0];
        const i = (y * this.w + x) * 4;
        return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
    }

    set(x, y, color)
    {
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h)
            return this;
        const c = hex(color);
        const i = (y * this.w + x) * 4;
        if (c[3] == 255)
        {
            this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
        }
        else
        {
            // ALPHA BLEND OVER WHAT'S THERE
            const a = c[3] / 255;
            this.data[i] = this.data[i] * (1 - a) + c[0] * a;
            this.data[i + 1] = this.data[i + 1] * (1 - a) + c[1] * a;
            this.data[i + 2] = this.data[i + 2] * (1 - a) + c[2] * a;
            this.data[i + 3] = Math.max(this.data[i + 3], c[3]);
        }
        return this;
    }

    rect(x, y, w, h, color)
    {
        for (let yy = y; yy < y + h; yy++)
            for (let xx = x; xx < x + w; xx++)
                this.set(xx, yy, color);
        return this;
    }

    disc(cx, cy, r, color, ry = r)
    {
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
            for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
            {
                const dx = (x + .5 - cx) / r, dy = (y + .5 - cy) / ry;
                if (dx * dx + dy * dy <= 1)
                    this.set(x, y, color);
            }
        return this;
    }

    line(x0, y0, x1, y1, color)
    {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= steps; i++)
            this.set(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), color);
        return this;
    }

    // ADD AN OUTLINE AROUND EVERYTHING THAT'S DRAWN
    outline(color = 'k')
    {
        const copy = this.clone();
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++)
            {
                if (copy.get(x, y)[3] > 0)
                    continue;
                if (copy.get(x - 1, y)[3] > 0 || copy.get(x + 1, y)[3] > 0 || copy.get(x, y - 1)[3] > 0 || copy.get(x, y + 1)[3] > 0)
                    this.set(x, y, color);
            }
        return this;
    }

    draw(src, ox = 0, oy = 0)
    {
        for (let y = 0; y < src.h; y++)
            for (let x = 0; x < src.w; x++)
            {
                const c = src.get(x, y);
                if (c[3] > 0)
                    this.set(ox + x, oy + y, c);
            }
        return this;
    }

    clone()
    {
        const p = new Pix(this.w, this.h);
        p.data.set(this.data);
        return p;
    }

    scale(f)
    {
        const p = new Pix(this.w * f, this.h * f);
        for (let y = 0; y < p.h; y++)
            for (let x = 0; x < p.w; x++)
            {
                const c = this.get(Math.floor(x / f), Math.floor(y / f));
                if (c[3] > 0)
                    p.set(x, y, c);
            }
        return p;
    }

    flipX()
    {
        const p = new Pix(this.w, this.h);
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++)
            {
                const c = this.get(x, y);
                if (c[3] > 0)
                    p.set(this.w - 1 - x, y, c);
            }
        return p;
    }

    shift(dx, dy)
    {
        const p = new Pix(this.w, this.h);
        p.draw(this, dx, dy);
        return p;
    }

    // REPLACE PALETTE COLORS, EG { r: 'b' } TURNS RED INTO BLUE
    recolor(map)
    {
        const p = this.clone();
        const pairs = Object.entries(map).map(([from, to]) => [hex(from), hex(to)]);
        for (let i = 0; i < p.data.length; i += 4)
        {
            for (const [from, to] of pairs)
            {
                if (p.data[i] == from[0] && p.data[i + 1] == from[1] && p.data[i + 2] == from[2] && p.data[i + 3] > 0)
                {
                    p.data[i] = to[0]; p.data[i + 1] = to[1]; p.data[i + 2] = to[2];
                    break;
                }
            }
        }
        return p;
    }

    async save(file)
    {
        const img = sharp(Buffer.from(this.data), { raw: { width: this.w, height: this.h, channels: 4 } });
        if (file.endsWith('.webp'))
            await img.webp({ lossless: true }).toFile(file);
        else
            await img.png().toFile(file);
    }
}

module.exports = { Pix, PALETTE, hex, shade, rng };
