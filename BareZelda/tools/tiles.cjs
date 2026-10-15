// PAINTS 16x16 MAP TILES. MAPS ARE BAKED INTO ONE IMAGE EACH BY maps.cjs, SO THESE NEVER GO IN THE ATLAS.

const { Pix, shade, rng } = require('./pixel.cjs');

const T = 16;

// HOW EACH TILE CHARACTER BEHAVES. ANYTHING NOT LISTED IS WALKABLE
const SOLID = new Set(['T', 'R', 'M', 'H', '^', 'F', 'W', '#', 'O', ' ', 'L', 'G', 'Y']);
const WATER = new Set(['~']);

const THEMES = {
    overworld: {},
    forest: { floor: '#4f6b3c', floorDark: '#405a30', wall: '#6b5a3a', wallDark: '#463a24', wallLight: '#8f7a52', tint: '#c9d6a8' },
    cave: { floor: '#6e6258', floorDark: '#5b5048', wall: '#4d4a55', wallDark: '#2f2d36', wallLight: '#6f6c7a', tint: '#c8c0b8' },
    lake: { floor: '#3c6a86', floorDark: '#305870', wall: '#2c406e', wallDark: '#1c2a4c', wallLight: '#4d66a2', tint: '#a8c8f0' },
    fire: { floor: '#6a3c32', floorDark: '#58302a', wall: '#7c2c2c', wallDark: '#4e1a1a', wallLight: '#a84646', tint: '#f0b0a0' },
    dark: { floor: '#3e2e4e', floorDark: '#30243e', wall: '#4c2c5c', wallDark: '#2a1636', wallLight: '#6c4c84', tint: '#c8b0e0' },
};

function speckle(p, base, colors, rand, count)
{
    p.rect(0, 0, T, T, base);
    for (let i = 0; i < count; i++)
        p.set(Math.floor(rand() * T), Math.floor(rand() * T), colors[Math.floor(rand() * colors.length)]);
    return p;
}

const GRASS = '#3fa556';

function grass(p, rand)
{
    speckle(p, GRASS, ['#5cc068', '#2f8a48', '#4cb35e'], rand, 18);
    // LITTLE GRASS BLADES
    for (let i = 0; i < 3; i++)
    {
        const x = Math.floor(rand() * 14) + 1, y = Math.floor(rand() * 13) + 2;
        p.set(x, y, '#2f8a48'); p.set(x + 1, y - 1, '#2f8a48');
    }
}

function tree(p, rand)
{
    grass(p, rand);
    p.rect(6, 11, 4, 5, '#5e3c22');
    p.rect(7, 11, 1, 5, '#7a5030');
    p.disc(8, 7, 7.2, '#1a1c2c', 6.6);
    p.disc(8, 7, 6.6, '#1f6b45', 6);
    p.disc(7, 6, 4.8, '#2f8a48', 4.2);
    p.disc(6, 5, 2.4, '#5cc068', 2);
}

function deadTree(p, rand)
{
    speckle(p, '#4a4060', ['#3c3450', '#584e70'], rand, 14);
    p.rect(7, 4, 2, 12, '#2a2030');
    p.line(8, 8, 3, 3, '#2a2030');
    p.line(8, 6, 13, 2, '#2a2030');
    p.line(8, 11, 12, 8, '#2a2030');
}

function rockTile(p, rand, bg)
{
    bg(p, rand);
    p.disc(8, 9, 7.5, '#1a1c2c', 6.5);
    p.disc(8, 9, 6.8, '#566c86', 5.8);
    p.disc(7, 7.5, 4, '#94b0c2', 3.2);
    p.disc(10, 11, 3, '#333c57', 2);
}

function cliff(p, rand)
{
    p.rect(0, 0, T, T, '#9a6438');
    for (let y = 2; y < T; y += 5)
        p.line(0, y + Math.floor(rand() * 2), T, y + Math.floor(rand() * 2), '#5e3c22');
    for (let i = 0; i < 6; i++)
        p.set(Math.floor(rand() * T), Math.floor(rand() * T), '#d9a066');
    p.rect(0, 0, T, 1, '#b8804a');
}

function water(p, rand, x, y, grid)
{
    p.rect(0, 0, T, T, '#2e6cc4');
    for (let i = 0; i < 3; i++)
    {
        const wx = Math.floor(rand() * 11), wy = Math.floor(rand() * 14) + 1;
        p.rect(wx, wy, 4, 1, '#5a9ff0');
        p.rect(wx + 1, wy - 1, 2, 1, '#5a9ff0');
    }
    // FOAM WHERE THE WATER MEETS LAND
    const land = (dx, dy) => { const c = grid.at(x + dx, y + dy); return c != null && c != '~' && c != 'B'; };
    if (land(0, -1)) { p.rect(0, 0, T, 2, '#9fd4ff'); p.rect(0, 2, T, 1, '#5a9ff0'); }
    if (land(0, 1)) p.rect(0, 15, T, 1, '#9fd4ff');
    if (land(-1, 0)) p.rect(0, 0, 1, T, '#9fd4ff');
    if (land(1, 0)) p.rect(15, 0, 1, T, '#9fd4ff');
}

function bricks(p, base, dark, light)
{
    p.rect(0, 0, T, T, base);
    for (let y = 0; y < T; y += 4)
    {
        p.rect(0, y, T, 1, dark);
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < T; x += 8)
            p.rect(x, y, 1, 4, dark);
        p.rect(0, y + 1, T, 1, light);
    }
}

// PAINTS ONE TILE. grid.at(x, y) GIVES THE TILE CHARACTER AT A POSITION, FOR EDGES AND SHADOWS
function paintTile(ch, theme, x, y, grid)
{
    const p = new Pix(T, T);
    const rand = rng((x * 73856093) ^ (y * 19349663) ^ ch.charCodeAt(0) * 83492791);
    const th = THEMES[theme];
    const dungeon = theme != 'overworld';

    switch (ch)
    {
        case '.':
            if (!dungeon) { grass(p, rand); break; }
            p.rect(0, 0, T, T, th.floor);
            p.rect(0, 0, T, 1, th.floorDark); p.rect(0, 0, 1, T, th.floorDark);
            p.rect(8, 0, 1, 8, th.floorDark); p.rect(0, 8, T, 1, th.floorDark);
            for (let i = 0; i < 4; i++)
                p.set(Math.floor(rand() * T), Math.floor(rand() * T), shade(th.floor, 1.12));
            break;
        case ',':
            grass(p, rand);
            for (let i = 0; i < 3; i++)
            {
                const fx = Math.floor(rand() * 12) + 2, fy = Math.floor(rand() * 12) + 2;
                const col = ['#f4f4f4', '#ffcd75', '#ff8fb0'][Math.floor(rand() * 3)];
                p.set(fx, fy - 1, col); p.set(fx - 1, fy, col); p.set(fx + 1, fy, col); p.set(fx, fy + 1, col);
                p.set(fx, fy, '#ef7d57');
            }
            break;
        case ':':
            speckle(p, '#d9a066', ['#c48a52', '#e8b884', '#b87a46'], rand, 16);
            break;
        case '_':
            speckle(p, '#f0d8a0', ['#d9c088', '#fff0c8'], rand, 14);
            break;
        case 'A':
            speckle(p, '#5a4a48', ['#4a3c3a', '#6e5c58', '#7a3a30'], rand, 16);
            break;
        case 'X':
            speckle(p, '#4a4060', ['#3c3450', '#584e70'], rand, 14);
            break;
        case 'S':
            p.rect(0, 0, T, T, '#a8bccc');
            p.rect(0, 0, T, 1, '#7c90a4'); p.rect(0, 0, 1, T, '#7c90a4');
            p.rect(8, 0, 1, 8, '#7c90a4'); p.rect(0, 8, T, 1, '#7c90a4');
            break;
        case 'T': tree(p, rand); break;
        case 'Y': deadTree(p, rand); break;
        case 'R': rockTile(p, rand, (q, r) => (grid.region(x, y) == 'A' ? speckle(q, '#5a4a48', ['#4a3c3a'], r, 10) : grass(q, r))); break;
        case 'M': cliff(p, rand); break;
        case 'C':
            if (dungeon) { p.rect(0, 0, T, T, '#1a1c2c'); break; }
            cliff(p, rand);
            p.disc(8, 12, 6.5, '#1a1c2c', 10);
            p.rect(1, 12, 14, 4, '#1a1c2c');
            break;
        case '~': water(p, rand, x, y, grid); break;
        case 'B':
            water(p, rand, x, y, grid);
            p.rect(1, 0, 14, T, '#9a6438');
            for (let yy = 0; yy < T; yy += 4) p.rect(1, yy, 14, 1, '#5e3c22');
            p.rect(1, 0, 1, T, '#5e3c22'); p.rect(14, 0, 1, T, '#5e3c22');
            break;
        case 'H':
            p.rect(0, 0, T, T, '#d9a066');
            for (let yy = 3; yy < T; yy += 4) p.rect(0, yy, T, 1, '#9a6438');
            p.rect(0, 0, 1, T, '#9a6438');
            break;
        case '^':
            p.rect(0, 0, T, T, '#b13e53');
            for (let yy = 0; yy < T; yy += 4)
            {
                p.rect(0, yy + 3, T, 1, '#7a2840');
                for (let xx = (yy / 4) % 2 ? 0 : 4; xx < T; xx += 8) p.rect(xx, yy, 1, 3, '#7a2840');
            }
            break;
        case 'D':
            p.rect(0, 0, T, T, '#d9a066');
            p.rect(3, 2, 10, 14, '#5e3c22');
            p.rect(4, 3, 8, 13, '#7a5030');
            p.set(10, 9, '#ffcd75');
            break;
        case 'F':
            grass(p, rand);
            p.rect(0, 5, T, 2, '#9a6438'); p.rect(0, 10, T, 2, '#9a6438');
            p.rect(2, 3, 3, 12, '#5e3c22'); p.rect(11, 3, 3, 12, '#5e3c22');
            break;
        case 'G':
            p.rect(0, 0, T, T, '#a8bccc');
            p.disc(8, 8, 7, '#566c86');
            p.disc(8, 8, 4.5, '#1c3a6a');
            p.disc(7, 7, 1.5, '#5a9ff0');
            break;
        case 'W':
            bricks(p, '#4c3a5c', '#2a1e36', '#6a547e');
            break;
        case 'L':
            p.rect(0, 0, T, T, '#d0502c');
            for (let i = 0; i < 4; i++)
                p.disc(rand() * T, rand() * T, 2 + rand() * 2, '#ffcd75', 1 + rand());
            for (let i = 0; i < 6; i++) p.set(Math.floor(rand() * T), Math.floor(rand() * T), '#7a1a1a');
            break;
        case '=':
            p.rect(0, 0, T, T, '#566c86');
            for (let yy = 0; yy < T; yy += 4) { p.rect(0, yy, T, 3, '#94b0c2'); p.rect(0, yy + 3, T, 1, '#333c57'); }
            break;
        case '+':
            p.rect(0, 0, T, T, '#7a2840');
            p.rect(0, 0, T, 2, '#ffcd75'); p.rect(0, 14, T, 2, '#ffcd75');
            p.rect(0, 3, T, 1, '#b13e53'); p.rect(0, 12, T, 1, '#b13e53');
            break;
        case 'O':
            paintFloorInto(p, theme, rand);
            p.rect(3, 4, 10, 12, '#1a1c2c');
            p.rect(4, 4, 8, 11, '#94b0c2');
            p.rect(4, 4, 3, 11, '#c0d0dc');
            p.rect(10, 4, 2, 11, '#566c86');
            p.rect(2, 1, 12, 4, '#1a1c2c');
            p.rect(3, 1, 10, 3, '#c0d0dc');
            break;
        case '#':
            bricks(p, th.wall, th.wallDark, th.wallLight);
            break;
        case ' ':
            p.rect(0, 0, T, T, '#0e0e16');
            break;
        default:
            throw new Error(`No tile painter for "${ch}"`);
    }

    // DEPTH: A WALL WITH FLOOR BELOW GETS A DARK FRONT FACE, AND FLOOR BELOW A WALL GETS A SHADOW
    if (dungeon)
    {
        const below = grid.at(x, y + 1);
        const above = grid.at(x, y - 1);
        if (ch == '#' && below != null && below != '#' && below != ' ')
        {
            p.rect(0, 10, T, 6, th.wallDark);
            p.rect(0, 10, T, 1, shade(th.wallDark, .7));
        }
        if (ch != '#' && ch != ' ' && (above == '#' || above == ' '))
            p.rect(0, 0, T, 3, '#00000055');
    }

    return p;
}

function paintFloorInto(p, theme, rand)
{
    const th = THEMES[theme];
    if (theme == 'overworld') { grass(p, rand); return; }
    p.rect(0, 0, T, T, th.floor);
    p.rect(0, 0, T, 1, th.floorDark); p.rect(0, 0, 1, T, th.floorDark);
}

module.exports = { paintTile, SOLID, WATER, THEMES, T };
