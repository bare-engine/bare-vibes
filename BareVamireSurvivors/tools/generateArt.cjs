// Generates the game's placeholder sprites as PNGs in texturePackImages/.
// The dev server packs them into the atlas. Run: node tools/generateArt.cjs
const path = require("path");
const fs = require("fs");
const sharp = require(require.resolve("sharp", { paths: [path.join(__dirname, "..", "node_modules", "bare-engine"), __dirname] }));

const outDir = path.join(__dirname, "..", "texturePackImages");

const svg = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const sprites = {
    player: svg(48, 56, `
        <ellipse cx="24" cy="52" rx="14" ry="4" fill="#000" opacity=".3"/>
        <path d="M10 50 L16 20 Q24 4 32 20 L38 50 Z" fill="#2b4c9b" stroke="#16264f" stroke-width="2"/>
        <circle cx="24" cy="22" r="9" fill="#f2c9a0"/>
        <path d="M13 22 Q24 0 35 22 Q30 13 24 13 Q18 13 13 22 Z" fill="#3a63c4"/>
        <circle cx="20" cy="23" r="1.8" fill="#222"/><circle cx="28" cy="23" r="1.8" fill="#222"/>
        <rect x="21" y="34" width="6" height="10" fill="#f5d142"/>`),

    bat: svg(40, 26, `
        <path d="M20 8 L2 2 L8 14 L2 22 L14 16 L20 22 L26 16 L38 22 L32 14 L38 2 Z" fill="#6b3fa0" stroke="#3a1f5c" stroke-width="1.5"/>
        <circle cx="17" cy="11" r="1.6" fill="#ff4d4d"/><circle cx="23" cy="11" r="1.6" fill="#ff4d4d"/>`),

    zombie: svg(36, 44, `
        <ellipse cx="18" cy="41" rx="11" ry="3" fill="#000" opacity=".3"/>
        <rect x="8" y="18" width="20" height="20" rx="3" fill="#5a7a3a" stroke="#2f4220" stroke-width="2"/>
        <circle cx="18" cy="12" r="9" fill="#8fbf5a" stroke="#2f4220" stroke-width="2"/>
        <circle cx="14" cy="11" r="2" fill="#e8e83a"/><circle cx="22" cy="12" r="1.5" fill="#e8e83a"/>
        <rect x="2" y="20" width="8" height="4" fill="#8fbf5a"/><rect x="26" y="20" width="8" height="4" fill="#8fbf5a"/>`),

    skeleton: svg(36, 44, `
        <ellipse cx="18" cy="41" rx="11" ry="3" fill="#000" opacity=".3"/>
        <rect x="11" y="18" width="14" height="18" rx="2" fill="#ddd8c4" stroke="#6d6857" stroke-width="2"/>
        <line x1="11" y1="23" x2="25" y2="23" stroke="#6d6857" stroke-width="1.5"/>
        <line x1="11" y1="28" x2="25" y2="28" stroke="#6d6857" stroke-width="1.5"/>
        <circle cx="18" cy="11" r="9" fill="#f0ecdc" stroke="#6d6857" stroke-width="2"/>
        <circle cx="14.5" cy="11" r="2.5" fill="#222"/><circle cx="21.5" cy="11" r="2.5" fill="#222"/>`),

    ghost: svg(36, 40, `
        <path d="M4 38 L4 16 Q18 -6 32 16 L32 38 L26 33 L21 38 L15 33 L10 38 Z" fill="#cfe8ff" opacity=".9" stroke="#7aa2c8" stroke-width="2"/>
        <circle cx="13" cy="17" r="3" fill="#223"/><circle cx="23" cy="17" r="3" fill="#223"/>`),

    ogre: svg(80, 84, `
        <ellipse cx="40" cy="80" rx="28" ry="5" fill="#000" opacity=".35"/>
        <rect x="14" y="32" width="52" height="44" rx="10" fill="#a0402c" stroke="#4d1c12" stroke-width="3"/>
        <circle cx="40" cy="26" r="20" fill="#c45a3c" stroke="#4d1c12" stroke-width="3"/>
        <path d="M24 12 L20 0 L30 8 Z M56 12 L60 0 L50 8 Z" fill="#eee2c0"/>
        <circle cx="32" cy="24" r="4" fill="#ffe14d"/><circle cx="48" cy="24" r="4" fill="#ffe14d"/>
        <path d="M30 36 L50 36 L46 40 L34 40 Z" fill="#fff"/>`),

    gem_blue: svg(14, 18, `<path d="M7 0 L14 7 L7 18 L0 7 Z" fill="#3fa9ff" stroke="#0d4f8a" stroke-width="1.5"/><path d="M7 2 L10 7 L7 7 Z" fill="#c8e8ff"/>`),
    gem_green: svg(16, 20, `<path d="M8 0 L16 8 L8 20 L0 8 Z" fill="#42e06a" stroke="#156b2c" stroke-width="1.5"/><path d="M8 2 L11 8 L8 8 Z" fill="#d4ffe0"/>`),
    gem_red: svg(18, 22, `<path d="M9 0 L18 9 L9 22 L0 9 Z" fill="#ff4a5e" stroke="#7a1020" stroke-width="1.5"/><path d="M9 2 L12 9 L9 9 Z" fill="#ffd4da"/>`),

    heart: svg(22, 20, `<path d="M11 19 L2 10 Q-2 3 5 1 Q9 0 11 5 Q13 0 17 1 Q24 3 20 10 Z" fill="#ff3b5c" stroke="#7a1020" stroke-width="1.5"/>`),

    bolt: svg(20, 20, `
        <defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#7ff3ff"/><stop offset="1" stop-color="#1aa3ff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="10" cy="10" r="10" fill="url(#g)"/>`),

    knife: svg(28, 8, `<path d="M0 4 L18 0 L28 4 L18 8 Z" fill="#d9e1ea" stroke="#5b6672" stroke-width="1"/><rect x="0" y="2.5" width="7" height="3" fill="#7a4b22"/>`),

    orb: svg(28, 28, `
        <defs><radialGradient id="o"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffb52e"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient></defs>
        <circle cx="14" cy="14" r="14" fill="url(#o)"/>`),

    aura: svg(128, 128, `
        <defs><radialGradient id="a"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".7" stop-color="#ffffff" stop-opacity=".12"/><stop offset=".95" stop-color="#ffffff" stop-opacity=".45"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="64" cy="64" r="64" fill="url(#a)"/>`),

    spark: svg(8, 8, `<circle cx="4" cy="4" r="4" fill="#fff"/>`),

    arrow: svg(24, 24, `<path d="M24 12 L4 2 L9 12 L4 22 Z" fill="#fff" stroke="#000" stroke-width="1.5"/>`),

    ground: svg(64, 64, `
        <rect width="64" height="64" fill="#2f4a2a"/>
        <rect x="0" y="0" width="32" height="32" fill="#324f2c"/><rect x="32" y="32" width="32" height="32" fill="#324f2c"/>
        <path d="M10 14 l2 -5 l2 5 M44 50 l2 -5 l2 5 M50 12 l2 -4 l2 4 M18 46 l2 -4 l2 4" stroke="#4d7040" stroke-width="1.5" fill="none"/>`),

    tree: svg(64, 80, `
        <ellipse cx="32" cy="76" rx="20" ry="4" fill="#000" opacity=".35"/>
        <rect x="27" y="50" width="10" height="26" fill="#5b3a1e"/>
        <circle cx="32" cy="34" r="24" fill="#1f5a2a" stroke="#0e2e14" stroke-width="2"/>
        <circle cx="24" cy="28" r="10" fill="#2a7337"/>`),

    rock: svg(40, 30, `<path d="M4 28 L0 16 L10 4 L28 2 L40 14 L36 28 Z" fill="#6f747a" stroke="#34383c" stroke-width="2"/><path d="M10 6 L20 10 L28 4" stroke="#9aa0a6" fill="none" stroke-width="2"/>`),

    flower: svg(14, 14, `<circle cx="7" cy="3" r="3" fill="#ffd6f0"/><circle cx="11" cy="7" r="3" fill="#ffd6f0"/><circle cx="7" cy="11" r="3" fill="#ffd6f0"/><circle cx="3" cy="7" r="3" fill="#ffd6f0"/><circle cx="7" cy="7" r="2.5" fill="#ffcf3a"/>`),
};

(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, content] of Object.entries(sprites)) {
        await sharp(Buffer.from(content)).png().toFile(path.join(outDir, `${name}.png`));
        console.log(`wrote ${name}.png`);
    }
})();
