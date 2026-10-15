// Builds public/data/levels/*.json from the ASCII maps below.
// Run: node tools/buildLevels.cjs
// Note: this overwrites the level files, so changes made in the level editor are lost.
//
//   #  block (horizontal runs are merged into one tiled block)
//   ^  spikes on a floor      v  spikes on a ceiling
//   o  orb                    P  player start
//   G  goal (top cell of the 2-cell-tall portal)

const fs = require('fs');
const path = require('path');

const CELL = 64;
const ROWS = 11;

// EVERY LEVEL IS BUILT ON A GRID: g.floor / g.ceil LAY TERRAIN, THE REST PLACE THINGS
function Grid(width)
{
    const rows = Array.from({ length: ROWS }, () => Array(width).fill('.'));
    const set = (row, a, b, ch) => { for (let c = a; c <= b; c++) rows[row][c] = ch; };
    return {
        rows,
        floor: (a, b) => set(ROWS - 1, a, b, '#'),
        ceil: (a, b) => set(0, a, b, '#'),
        block: (row, a, b) => set(row, a, b, '#'),
        spikeF: (a, b, row = ROWS - 2) => set(row, a, b, '^'),
        spikeC: (a, b, row = 1) => set(row, a, b, 'v'),
        orb: (c, row) => set(row, c, c, 'o'),
        player: (c, row = ROWS - 2) => set(row, c, c, 'P'),
        goal: (c, row = ROWS - 3) => set(row, c, c, 'G'),
    };
}

const levels = [
    {
        name: 'level1', title: 'First Flip', speed: 380, width: 84,
        build(g)
        {
            g.floor(0, 83); g.ceil(0, 83);
            g.player(2);
            g.orb(12, 5);
            g.spikeF(15, 18);
            g.orb(24, 5);
            g.spikeC(27, 30);
            g.spikeF(38, 42);
            g.orb(46, 5);
            g.spikeC(50, 54);
            g.spikeF(61, 64);
            g.orb(66, 5);
            g.spikeC(70, 72);
            g.goal(79);
        },
    },
    {
        name: 'level2', title: 'Mind the Gap', speed: 420, width: 104,
        build(g)
        {
            g.ceil(0, 103);
            g.floor(0, 15); g.floor(21, 37); g.floor(44, 103);
            g.player(2);
            g.orb(18, 1);
            g.spikeC(25, 29);
            g.orb(40, 1);
            g.spikeC(52, 56);
            g.block(9, 62, 64); g.block(8, 62, 64);   // A WALL ON THE FLOOR
            g.orb(63, 1);
            g.spikeC(72, 75);
            g.floor(78, 103);
            g.spikeF(82, 86);
            g.orb(84, 1);
            g.spikeC(92, 94);
            g.goal(99);
        },
    },
    {
        name: 'level3', title: 'Zipper', speed: 480, width: 112,
        build(g)
        {
            g.floor(0, 111); g.ceil(0, 111);
            g.player(2);
            // THE GAPS GET SHORTER AS YOU GO
            const gaps = [9, 9, 8, 8, 7, 7, 6, 6, 6, 6];
            let c = 14;
            gaps.forEach((gap, i) =>
            {
                if (i % 2 == 0) g.spikeF(c, c + 3);
                else g.spikeC(c, c + 3);
                g.orb(c - 2, 5);
                c += gap;
            });
            g.goal(106);
        },
    },
    {
        name: 'level4', title: 'Islands', speed: 500, width: 120,
        build(g)
        {
            g.ceil(0, 119);
            g.floor(0, 16);
            g.player(2);
            // AN ISLAND HANGING MID-AIR. THE CEILING ABOVE IT IS SPIKED, SO LAND ON ITS UNDERSIDE (OR ITS TOP)
            g.block(5, 18, 34);
            g.spikeC(22, 30);
            g.orb(26, 7);
            g.floor(42, 62);
            g.spikeC(48, 52);
            g.orb(46, 5);
            // SECOND ISLAND, WITH SPIKES ON TOP: ONLY ITS UNDERSIDE IS SAFE
            g.block(5, 64, 78);
            g.spikeF(64, 78, 4);
            g.spikeC(62, 70);
            g.orb(72, 7);
            g.floor(86, 119);
            g.spikeC(92, 95);
            g.spikeF(100, 103);
            g.orb(98, 5);
            g.spikeC(108, 110);
            g.goal(114);
        },
    },
    {
        name: 'level5', title: 'Gauntlet', speed: 560, width: 150,
        build(g)
        {
            g.ceil(0, 149);
            g.floor(0, 20); g.floor(26, 60); g.floor(66, 149);
            g.player(2);
            g.spikeF(12, 14);
            g.orb(15, 1);
            g.spikeC(28, 31);
            g.spikeF(37, 40);
            g.spikeC(45, 47);
            g.block(1, 52, 54); g.block(2, 52, 54);   // A WALL HANGING FROM THE CEILING
            g.orb(53, 9);
            g.spikeF(70, 73);
            g.spikeC(78, 81);
            g.block(5, 88, 104);
            g.spikeC(86, 106);
            g.orb(97, 7);
            // A FAST ZIGZAG TO FINISH
            g.spikeF(110, 113);
            g.spikeC(116, 119);
            g.spikeF(121, 124);
            g.orb(125, 5);
            g.spikeC(126, 129);
            g.spikeF(131, 134);
            g.spikeC(136, 139);
            g.goal(145);
        },
    },
];

function ToEntities(rows)
{
    const entities = [];
    const add = (extend, col, row, extra = {}) =>
        entities.push({ extends: extend, position: { x: col * CELL, y: row * CELL }, ...extra });

    rows.forEach((cells, row) =>
    {
        for (let col = 0; col < cells.length; col++)
        {
            const ch = cells[col];
            if (ch == '#' || ch == '^' || ch == 'v')
            {
                // MERGE A HORIZONTAL RUN INTO ONE TILED OBJECT
                let end = col;
                while (cells[end + 1] == ch) end++;
                const length = end - col + 1;
                const scale = length > 1 ? { scale: { x: length, y: 1 } } : {};
                if (ch == '#') add('block', col, row, scale);
                if (ch == '^') entities.push({ extends: 'spikeUp', position: { x: col * CELL, y: row * CELL + CELL / 2 }, ...scale });
                if (ch == 'v') entities.push({ extends: 'spikeDown', position: { x: col * CELL, y: row * CELL }, ...scale });
                col = end;
            }
            else if (ch == 'o')
                entities.push({ extends: 'orb', position: { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 } });
            else if (ch == 'P')
                entities.push({ extends: 'player', position: { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 + 8 } });
            else if (ch == 'G')
                add('goal', col, row);
        }
    });
    return entities;
}

const outDir = path.join(__dirname, '..', 'public', 'data', 'levels');
fs.mkdirSync(outDir, { recursive: true });

levels.forEach((level, index) =>
{
    const g = Grid(level.width);
    level.build(g);
    const entities = ToEntities(g.rows);
    const data = {
        name: level.name,
        dimensions: { width: level.width * CELL, height: ROWS * CELL },
        customData: { title: level.title, speed: level.speed, index: index + 1 },
        entitiesByLayer: { objects: entities },
    };
    fs.writeFileSync(path.join(outDir, level.name + '.json'), JSON.stringify(data, null, 2) + '\n');
    if (process.argv.includes('--print'))
        console.log(`\n${level.name} (${level.title})\n` + g.rows.map(r => r.join('')).join('\n'));
});
console.log(`Wrote ${levels.length} levels to ${outDir}`);
