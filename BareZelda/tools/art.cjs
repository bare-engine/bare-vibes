// GENERATES THE GAME'S SPRITES INTO texturePackImages/, WHICH THE DEV SERVER PACKS INTO THE ATLAS.
// RUN: npm run build:art

const fs = require('fs');
const path = require('path');
const { Pix } = require('./pixel.cjs');

const OUT = path.join(__dirname, '..', 'texturePackImages');

// ---------------------------------------------------------------------------------------------
// HUMANOID TEMPLATE, RECOLORED FOR THE HERO, NPCS, SKELETONS AND TWO BOSSES
// H HAIR/HAT  h HAIR SHADE  S SKIN  s SKIN SHADE  E EYES  C CLOTH  c CLOTH SHADE  B BELT/BOOTS
// ---------------------------------------------------------------------------------------------

const DOWN1 = [
    '......kkkk......',
    '....kkHHHHkk....',
    '...kHHHHHHHHk...',
    '..kHHHHHHHHHHk..',
    '..khHHHHHHHHhk..',
    '..khSSSSSSSShk..',
    '..khSESSSSEShk..',
    '...kSSSSSSSSk...',
    '....kkSssSkk....',
    '...kCCCCCCCCk...',
    '..kSCCCCCCCCSk..',
    '..kSkBBBBBBkSk..',
    '...kCCCCCCCCk...',
    '...kcCCCCCCck...',
    '....kBBkkBBk....',
    '....kkk..kkk....',
];
const DOWN2 = [...DOWN1.slice(0, 14),
    '...kBBk..kBBk...',
    '...kkk....kkk...',
];
const UP1 = [
    '......kkkk......',
    '....kkHHHHkk....',
    '...kHHHHHHHHk...',
    '..kHHHHHHHHHHk..',
    '..khHHHHHHHHhk..',
    '..khhHHHHHHhhk..',
    '..khhhhhhhhhhk..',
    '...khhhhhhhhk...',
    '....kkhhhhkk....',
    '...kCCCCCCCCk...',
    '..kSCCCCCCCCSk..',
    '..kSkBBBBBBkSk..',
    '...kCCCCCCCCk...',
    '...kcCCCCCCck...',
    '....kBBkkBBk....',
    '....kkk..kkk....',
];
const UP2 = [...UP1.slice(0, 14), DOWN2[14], DOWN2[15]];
const SIDE1 = [
    '......kkkk......',
    '....kkHHHHkk....',
    '...kHHHHHHHHk...',
    '..kHHHHHHHHHHk..',
    '..khHHHHHHHHHk..',
    '..khhhSSSSSSSk..',
    '..khhhSSSSESSk..',
    '...khhSSSSSSSk..',
    '....kkSSSssk....',
    '....kCCCCCCk....',
    '...kCCCSSCCk....',
    '...kkBBSSBBk....',
    '....kCCCCCCk....',
    '....kcCCCCck....',
    '....kBBkBBk.....',
    '....kkk.kkk.....',
];
const SIDE2 = [...SIDE1.slice(0, 14),
    '...kBBk.kBBk....',
    '...kkk...kkk....',
];
const HOLD = [
    '..kk..kkkk..kk..',
    '.kSSkkHHHHkkSSk.',
    '.kSkHHHHHHHHkSk.',
    '.kCHHHHHHHHHHCk.',
    '.kChHHHHHHHHhCk.',
    '..khSSSSSSSShk..',
    '..khSESSSSEShk..',
    '...kSSSSSSSSk...',
    '....kkSssSkk....',
    '...kCCCCCCCCk...',
    '...kCCCCCCCCk...',
    '...kkBBBBBBkk...',
    '...kCCCCCCCCk...',
    '...kcCCCCCCck...',
    '....kBBkkBBk....',
    '....kkk..kkk....',
];
const SWIM = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkHHHHkk....',
    '...kHHHHHHHHk...',
    '..khHHHHHHHHhk..',
    '..khSESSSSEShk..',
    '...kSSSSSSSSk...',
    '.aa.kkSSSSkk.aa.',
    'aaaawaaaaaawaaaa',
    '.waaw..aa..waaw.',
    '................',
];

function person(rows, colors)
{
    return Pix.fromAscii(rows, { E: 'k', ...colors });
}

const HERO = { H: 'g', h: 'u', S: 's', s: 'z', C: 'g', c: 'e', B: 'x' };

const NPCS = {
    elder: { H: 'w', h: 'i', S: 's', s: 'z', C: 'v', c: 'p', B: 'u' },
    mina: { H: 'o', h: 'r', S: 's', s: 'z', C: 'f', c: 'r', B: 'x' },
    merchant: { H: 'y', h: 'q', S: 'z', s: 'u', C: 'b', c: 'n', B: 'x' },
    fisher: { H: 'q', h: 'u', S: 's', s: 'z', C: 't', c: 'n', B: 'x' },
    guard: { H: 'm', h: 'd', S: 's', s: 'z', C: 'r', c: 'p', B: 'x' },
    kid: { H: 'x', h: 'k', S: 's', s: 'z', C: 'y', c: 'o', B: 'b' },
};

const SKELETON = { H: 'w', h: 'i', S: 'w', s: 'i', C: 'i', c: 'm', B: 'w', E: 'r' };
const KNIGHT = { H: 'm', h: 'd', S: 'd', s: 'k', C: 'r', c: 'p', B: 'm', E: 'o' };
const LORD = { H: 'p', h: 'k', S: 'v', s: 'p', C: 'p', c: 'k', B: 'd', E: 'r' };

// ---------------------------------------------------------------------------------------------
// CREATURES
// ---------------------------------------------------------------------------------------------

const SLIME = Pix.fromAscii([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkllllkk....',
    '...klllwwlllk...',
    '..kllllwllllgk..',
    '..klllllllllgk..',
    '.kllkllllkllggk.',
    '.kllkllllkllggk.',
    '.kgllllllllgggk.',
    '..kggggggggggk..',
    '...kkkkkkkkkk...',
]);

const BAT1 = Pix.fromAscii([
    '................',
    '................',
    '................',
    '................',
    '.k............k.',
    '.kk..........kk.',
    '.kpk..kkkk..kpk.',
    '.kppkkppppkkppk.',
    '.kpppkprrpkpppk.',
    '..kppkppppkppk..',
    '...kk.kwwk.kk...',
    '......kkkk......',
    '................',
    '................',
    '................',
    '................',
]);
const BAT2 = Pix.fromAscii([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '..kkkkppppkkkk..',
    '.kpppkprrpkpppk.',
    '.kppppppppppppk.',
    '.kpk.kwppwk.kpk.',
    '.kk...kkkk...kk.',
    '.k............k.',
    '................',
    '................',
    '................',
]);

const OCTO_TOP = [
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrrrrrrwrrk..',
    '..krrrrrrrrwrk..',
    '.krrkwkrrkwkrrk.',
    '.krrkkkrrkkkrrk.',
    '.krrrrrrrrrrrrk.',
    '..krrrrkkrrrrk..',
    '..kkrrkookrrkk..',
    '.krkkrkkkkrkkrk.',
];
const OCTO1 = Pix.fromAscii([...OCTO_TOP,
    '.kr.krk..krk.rk.',
    '..k..kk..kk..k..',
    '................',
]);
const OCTO2 = Pix.fromAscii([...OCTO_TOP,
    '.k.rkrk..krkr.k.',
    '..k.kk....kk.k..',
    '................',
]);

const GOLEM = Pix.fromAscii([
    '................',
    '....kkkkkkkk....',
    '...kmmmmmmmmk...',
    '..kmiimmmmmmmk..',
    '..kmikkmmkkmmk..',
    '..kmmkrmmkrmmk..',
    '..kmmmmmmmmmmk..',
    '.kkmmdddddmmmkk.',
    'kmmkmmmmmmmmkmmk',
    'kmmkmmmimmmmkmmk',
    'kmmkmmmmmmmdkmmk',
    'kddkmmmmmmmdkddk',
    '.kk.kmmmmmmk.kk.',
    '....kmmkkmmk....',
    '...kmmmkkmmmk...',
    '...kkkkkkkkkk...',
]);

const SERPENT = Pix.fromAscii([
    '................',
    '.....kkkkk......',
    '...kkttttttk....',
    '..kttttttttak...',
    '..ktwktttttttk..',
    '..ktkkttttttttk.',
    '..kttttttkkkkkk.',
    '...kttttkrrrrrk.',
    '...ktttttkwkwk..',
    '...kattttkkkk...',
    '...kaatttk......',
    '..kaattttk......',
    '..kattttttk.....',
    '.kccattttttkc...',
    'kcccccccccccccck',
    'cwcccwccccwcccwc',
]);

const CAT = Pix.fromAscii([
    '................',
    '................',
    '................',
    '..kk...kk.......',
    '..kokkkok.......',
    '..kooooook......',
    '..kokookok......',
    '..kooyyook......',
    '...koooook......',
    '...kooooook.....',
    '..koooooooook...',
    '..kooyooooooook.',
    '..kooyooooookok.',
    '..kooooooooookk.',
    '..kkokkkkkokk...',
    '................',
]);

// ---------------------------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------------------------

const HEART = Pix.fromAscii([
    '.kk.kk..',
    'kwrkrrk.',
    'krrrrrk.',
    'krrrrrk.',
    '.krrrk..',
    '..krk...',
    '...k....',
    '........',
]);
function heartHalf()
{
    const p = HEART.clone();
    for (let y = 0; y < 8; y++)
        for (let x = 4; x < 8; x++)
        {
            const c = p.get(x, y);
            if (c[3] > 0 && !(c[0] == 0x1a && c[1] == 0x1c))
                p.set(x, y, 'd');
        }
    return p;
}

const RUPEE = Pix.fromAscii([
    '...kk...',
    '..klgk..',
    '.klwggk.',
    '.klwggk.',
    '.klggek.',
    '.klggek.',
    '.klggek.',
    '.klggek.',
    '.kgggek.',
    '..kgek..',
    '...kk...',
]);

const KEY = Pix.fromAscii([
    '..kkkk..',
    '.kyyyyk.',
    '.ky..yk.',
    '.kyyyyk.',
    '..kyyk..',
    '..kyk...',
    '..kyk...',
    '..kyyk..',
    '..kyk...',
    '..kyyk..',
    '..kkk...',
]);

const BOW = Pix.fromAscii([
    '...kkk..........',
    '...kuuk.........',
    '...kw.uk........',
    '...kw..uk.......',
    '...kw...uk......',
    '...kw....uk.....',
    '...kw....uk.....',
    '...kw.....uk....',
    '...kw.....uk....',
    '...kw....uk.....',
    '...kw....uk.....',
    '...kw...uk......',
    '...kw..uk.......',
    '...kw.uk........',
    '...kuuk.........',
    '...kkk..........',
]);

const ARROW = Pix.fromAscii([
    'kk...........k..',
    '.wkkkkkkkkkkkik.',
    'wwuuuuuuuuuuuiik',
    '.wkkkkkkkkkkkik.',
    'kk...........k..',
]);

const SWORD = Pix.fromAscii([
    '.......kk.......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '......kwik......',
    '....kkkkkkkk....',
    '....kyyyyyyk....',
    '....kkkuukkk....',
    '......kuuk......',
    '......kyyk......',
    '.......kk.......',
]);

function bomb()
{
    const p = new Pix(16, 16);
    p.disc(8, 10, 5.5, 'n');
    p.disc(7, 9, 3.5, 'b');
    p.rect(5, 7, 2, 2, 'c');
    p.rect(7, 3, 2, 2, 'm');
    p.outline();
    p.line(9, 2, 11, 0, 'u');
    p.set(11, 0, 'y');
    p.set(12, 0, 'o');
    return p;
}

function flippers()
{
    const p = new Pix(16, 16);
    p.disc(5, 9, 3.5, 'b', 6);
    p.disc(11, 9, 3.5, 'b', 6);
    p.disc(5, 8, 2, 'c', 4);
    p.disc(11, 8, 2, 'c', 4);
    p.outline();
    return p;
}

function fireRod()
{
    const p = new Pix(16, 16);
    p.line(3, 14, 10, 5, 'u');
    p.line(4, 14, 11, 5, 'x');
    p.disc(11.5, 4, 3, 'r');
    p.disc(11, 3.5, 1.5, 'o');
    p.set(10, 3, 'y');
    p.outline();
    return p;
}

function fireball()
{
    const p = new Pix(10, 10);
    p.disc(5, 5, 4.5, 'r');
    p.disc(5, 5, 3.2, 'o');
    p.disc(5, 5, 1.8, 'y');
    p.set(4, 4, 'w');
    return p;
}

function potion()
{
    const p = new Pix(16, 16);
    p.disc(8, 10, 5, 'r');
    p.disc(7, 9, 3, 'f');
    p.rect(6, 2, 4, 4, 'i');
    p.rect(6, 1, 4, 2, 'u');
    p.set(6, 8, 'w');
    p.outline();
    return p;
}

function sigil()
{
    // WHITE-GRAY GEM, TINTED PER DUNGEON IN THE GAME
    const p = Pix.fromAscii([
        '.......kk.......',
        '......kwwk......',
        '.....kwwiik.....',
        '....kwwwiiik....',
        '...kwwwiiiiik...',
        '..kwwwwiiiiimk..',
        '.kwwwwwiiiimmmk.',
        'kwwwwwwiiimmmmmk',
        '.kiiiiimmmmmmmk.',
        '..kiiiimmmmmdk..',
        '...kiiimmmmdk...',
        '....kiimmmdk....',
        '.....kimmdk.....',
        '......kmdk......',
        '.......kk.......',
        '................',
    ]);
    return p;
}

function ring()
{
    const p = new Pix(10, 10);
    p.disc(5, 6, 3.5, 'y');
    p.disc(5, 6, 2, [0, 0, 0, 0]);
    // PUNCH THE HOLE
    for (let y = 0; y < 10; y++)
        for (let x = 0; x < 10; x++)
        {
            const dx = x + .5 - 5, dy = y + .5 - 6;
            if (dx * dx + dy * dy < 3.2)
                p.data[(y * 10 + x) * 4 + 3] = 0;
        }
    p.disc(5, 2, 1.8, 'c');
    p.outline();
    return p;
}

function rock()
{
    const p = new Pix(8, 8);
    p.disc(4, 4, 3.4, 'm');
    p.disc(3.5, 3.5, 1.8, 'i');
    p.outline();
    return p;
}

// ---------------------------------------------------------------------------------------------
// OBJECTS
// ---------------------------------------------------------------------------------------------

const CHEST_BODY = [
    '.kuuuuuyyuuuuuk.',
    '.kuxxxxkkxxxxuk.',
    '.kuuuuuuuuuuuuk.',
    '.kuxxxxxxxxxxuk.',
    '.kuuuuuuuuuuuuk.',
    '.kyuuuuuuuuuuyk.',
    '.kkkkkkkkkkkkkk.',
    '................',
];
const CHEST = Pix.fromAscii([
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kuuuuuuuuuuuuk.',
    '.kuqqqqqqqqqquk.',
    '.kuuuuuuuuuuuuk.',
    '.kkkkkkyykkkkkk.',
    ...CHEST_BODY,
].slice(0, 15).concat(['................']));
const CHEST_OPEN = Pix.fromAscii([
    '................',
    '..kkkkkkkkkkkk..',
    '.kuqqqqqqqqqquk.',
    '.kuuuuuuuuuuuuk.',
    '.kkkkkkkkkkkkkk.',
    '.kxxxxxxxxxxxxk.',
    '.kkkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkkk.',
    '.kuuuuuuuuuuuuk.',
    ...CHEST_BODY.slice(1),
].slice(0, 15).concat(['................']));

const DOOR_LOCKED = Pix.fromAscii([
    'kkkkkkkkkkkkkkkk',
    'kiiiiiiiiiiiiiik',
    'kimkkkkkkkkkkmik',
    'kimkuuuuuuuukmik',
    'kimkuxuuuuxukmik',
    'kimkuuuuuuuukmik',
    'kimkuuuyyuuukmik',
    'kimkuuykkyuukmik',
    'kimkuuykkyuukmik',
    'kimkuuuykuuukmik',
    'kimkuuuykuuukmik',
    'kimkuuuyyuuukmik',
    'kimkuxuuuuxukmik',
    'kimkuuuuuuuukmik',
    'kimkkkkkkkkkkmik',
    'kkkkkkkkkkkkkkkk',
]);
const DOOR_BOSS = DOOR_LOCKED.recolor({ u: 'r', x: 'p', y: 'w' });

const BARS = '.kik.kik.kik.kik';
const GATE = Pix.fromAscii([
    'kkkkkkkkkkkkkkkk',
    'kmmmmmmmmmmmmmmk',
    'kkkkkkkkkkkkkkkk',
    BARS, BARS, BARS, BARS, BARS, BARS, BARS, BARS, BARS, BARS,
    'kkkkkkkkkkkkkkkk',
    'kmmmmmmmmmmmmmmk',
    'kkkkkkkkkkkkkkkk',
]);

function crystalSwitch(on)
{
    const p = new Pix(16, 16);
    p.rect(3, 11, 10, 4, 'm');
    p.rect(3, 11, 10, 1, 'i');
    p.rect(4, 15, 8, 1, 'd');
    const c1 = on ? 'o' : 'b', c2 = on ? 'y' : 'c';
    p.disc(8, 6.5, 4.5, c1);
    p.disc(7, 5.5, 2.5, c2);
    p.set(6, 4, 'w');
    p.outline();
    return p;
}

function torch(lit, frame = 0)
{
    const p = new Pix(16, 16);
    p.rect(6, 10, 4, 5, 'd');
    p.rect(3, 7, 10, 3, 'm');
    p.rect(3, 7, 10, 1, 'i');
    p.rect(5, 15, 6, 1, 'd');
    if (lit)
    {
        const sway = frame ? 1 : 0;
        p.disc(8, 4.5, 3.5, 'r', 4);
        p.disc(8 + sway, 4, 2.5, 'o', 3.5);
        p.disc(8 - sway, 4.5, 1.5, 'y', 2);
        p.set(8 + sway, 0, 'o');
    }
    p.outline();
    return p;
}

function brickWall(base, dark, light, crack)
{
    const p = new Pix(16, 16);
    p.rect(0, 0, 16, 16, base);
    for (let y = 0; y < 16; y += 4)
    {
        p.rect(0, y, 16, 1, dark);
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < 16; x += 8)
            p.rect(x, y, 1, 4, dark);
        p.rect(0, y + 1, 16, 1, light);
    }
    if (crack)
    {
        const pts = [[8, 1], [7, 4], [9, 7], [6, 10], [8, 13], [7, 15]];
        for (let i = 0; i < pts.length - 1; i++)
            p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'k');
        p.line(9, 7, 12, 9, 'k');
        p.line(7, 4, 4, 5, 'k');
    }
    return p;
}

function crackedRock()
{
    const p = new Pix(16, 16);
    p.disc(8, 9, 7.5, 'm', 6.5);
    p.disc(7, 7, 5, 'i', 4);
    p.disc(10, 11, 4, 'd', 2.5);
    p.line(8, 2, 6, 7, 'k');
    p.line(6, 7, 9, 10, 'k');
    p.line(9, 10, 7, 15, 'k');
    p.line(9, 10, 13, 9, 'k');
    p.outline();
    return p;
}

function bush()
{
    const p = new Pix(16, 16);
    p.disc(8, 9, 7, 'e', 6);
    p.disc(5, 8, 3.5, 'g');
    p.disc(11, 8, 3.5, 'g');
    p.disc(8, 6, 3.5, 'g');
    p.set(5, 6, 'l'); p.set(10, 5, 'l'); p.set(7, 4, 'l'); p.set(12, 7, 'l');
    p.outline();
    return p;
}

function pot()
{
    const p = new Pix(16, 16);
    p.disc(8, 10, 6, 'u', 5);
    p.disc(7, 9, 3.5, 'q', 3);
    p.rect(5, 3, 6, 3, 'x');
    p.rect(4, 3, 8, 1, 'u');
    p.outline();
    return p;
}

function sign()
{
    const p = new Pix(16, 16);
    p.rect(7, 10, 2, 6, 'x');
    p.rect(2, 2, 12, 8, 'u');
    p.rect(2, 2, 12, 1, 'q');
    p.rect(4, 4, 8, 1, 'x');
    p.rect(4, 6, 6, 1, 'x');
    p.outline();
    return p;
}

function thorns()
{
    const p = new Pix(16, 16);
    p.disc(8, 9, 7.5, 'p', 6.5);
    p.disc(5, 8, 3, 'e');
    p.disc(11, 10, 3, 'e');
    p.disc(8, 6, 2.5, 'e');
    const spikes = [[1, 6], [3, 2], [8, 1], [13, 3], [15, 8], [13, 14], [3, 14], [8, 15]];
    for (const [x, y] of spikes)
        p.line(8, 9, x, y, 'v');
    p.outline();
    return p;
}

function eye(open)
{
    const p = new Pix(16, 16);
    p.rect(1, 2, 14, 12, 'm');
    p.rect(1, 2, 14, 1, 'i');
    if (open)
    {
        p.disc(8, 8, 5.5, 'w', 3.5);
        p.disc(8, 8, 2.5, 'r');
        p.disc(8, 8, 1, 'k');
        p.set(7, 7, 'w');
    }
    else
    {
        p.line(3, 8, 13, 8, 'k');
        p.line(3, 9, 13, 9, 'd');
    }
    p.outline();
    return p;
}

function spark()
{
    const p = new Pix(4, 4);
    p.rect(1, 0, 2, 4, 'w');
    p.rect(0, 1, 4, 2, 'w');
    return p;
}

function puff()
{
    const p = new Pix(8, 8);
    p.disc(4, 4, 3.8, 'w');
    return p;
}

// ---------------------------------------------------------------------------------------------

async function main()
{
    // REMOVE THE TEMPLATE'S PLACEHOLDER IMAGE
    const gear = path.join(OUT, '⚙.png');
    if (fs.existsSync(gear))
        fs.unlinkSync(gear);

    const sprites = {};

    sprites.hero_down1 = person(DOWN1, HERO);
    sprites.hero_down2 = person(DOWN2, HERO);
    sprites.hero_up1 = person(UP1, HERO);
    sprites.hero_up2 = person(UP2, HERO);
    sprites.hero_side1 = person(SIDE1, HERO);
    sprites.hero_side2 = person(SIDE2, HERO);
    sprites.hero_hold = person(HOLD, HERO);
    sprites.hero_swim = person(SWIM, HERO);

    for (const [name, colors] of Object.entries(NPCS))
    {
        sprites[`npc_${name}1`] = person(DOWN1, colors);
        sprites[`npc_${name}2`] = person(DOWN1, colors).shift(0, 1);
    }
    sprites.npc_cat1 = CAT;
    sprites.npc_cat2 = CAT.shift(0, 1);

    sprites.slime1 = SLIME;
    sprites.slime2 = SLIME.shift(0, 1);
    sprites.bat1 = BAT1;
    sprites.bat2 = BAT2;
    sprites.octo1 = OCTO1;
    sprites.octo2 = OCTO2;
    sprites.skeleton1 = person(DOWN1, SKELETON);
    sprites.skeleton2 = person(DOWN2, SKELETON);

    // BOSSES, 32x32
    const king = SLIME.scale(2);
    for (const [x, y] of [[11, 7], [14, 5], [17, 5], [20, 7]])
        king.rect(x, y, 2, 4, 'y');
    king.rect(11, 10, 11, 2, 'y');
    king.rect(15, 8, 2, 2, 'r');
    sprites.boss_slime = king;
    sprites.boss_golem = GOLEM.scale(2);
    sprites.boss_serpent = SERPENT.scale(2);
    sprites.boss_knight = person(DOWN1, KNIGHT).scale(2);
    sprites.boss_lord = person(DOWN1, LORD).scale(2);

    // ITEMS
    sprites.heart = HEART;
    sprites.heart_half = heartHalf();
    sprites.heart_empty = HEART.recolor({ r: 'd', w: 'm' });
    sprites.heart_container = HEART.scale(2);
    sprites.rupee = RUPEE;
    sprites.rupee_blue = RUPEE.recolor({ l: 'a', g: 'c', e: 'b' });
    sprites.rupee_red = RUPEE.recolor({ l: 'f', g: 'r', e: 'p' });
    sprites.key = KEY;
    sprites.boss_key = KEY.recolor({ y: 'o' }).scale(2);
    sprites.sword = SWORD;
    sprites.bow = BOW;
    sprites.arrow = ARROW;
    sprites.bomb = bomb();
    sprites.flippers = flippers();
    sprites.fire_rod = fireRod();
    sprites.fireball = fireball();
    sprites.potion = potion();
    sprites.sigil = sigil();
    sprites.ring = ring();
    sprites.rock = rock();

    // OBJECTS
    sprites.chest = CHEST;
    sprites.chest_open = CHEST_OPEN;
    sprites.door_locked = DOOR_LOCKED;
    sprites.door_boss = DOOR_BOSS;
    sprites.gate = GATE;
    sprites.switch_off = crystalSwitch(false);
    sprites.switch_on = crystalSwitch(true);
    sprites.torch = torch(false);
    sprites.torch_lit1 = torch(true, 0);
    sprites.torch_lit2 = torch(true, 1);
    sprites.cracked_wall = brickWall('i', 'm', 'w', true);
    sprites.cracked_rock = crackedRock();
    sprites.bush = bush();
    sprites.pot = pot();
    sprites.sign = sign();
    sprites.thorns = thorns();
    sprites.eye_open = eye(true);
    sprites.eye_closed = eye(false);
    sprites.seal = DOOR_LOCKED.recolor({ u: 'p', x: 'k', y: 'v' });

    // FX
    sprites.spark = spark();
    sprites.puff = puff();

    for (const [name, pix] of Object.entries(sprites))
        await pix.save(path.join(OUT, `${name}.png`));

    console.log(`Wrote ${Object.keys(sprites).length} sprites to texturePackImages/`);
}

module.exports = { brickWall, Pix };

if (require.main === module)
    main().catch(e => { console.error(e); process.exit(1); });
