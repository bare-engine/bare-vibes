// GENERATES CHIPTUNE SOUND EFFECTS AND MUSIC LOOPS AS .wav FILES IN public/sounds/
// RUN: npm run build:sfx

const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'public', 'sounds');

function wav(samples)
{
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32000), i * 2));
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
}

const WAVES = {
    square: (p) => (p % 1 < 0.5 ? 1 : -1),
    pulse: (p) => (p % 1 < 0.25 ? 1 : -1),
    triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
    saw: (p) => 2 * (p % 1) - 1,
    sine: (p) => Math.sin(p * Math.PI * 2),
};

// ONE NOTE OR SWEEP: freq CAN SLIDE TO freq2
function tone(buf, start, dur, freq, { wave = 'square', vol = 0.3, freq2 = freq, attack = 0.005, release = 0.05, vibrato = 0 } = {})
{
    const s0 = Math.floor(start * RATE), n = Math.floor(dur * RATE);
    let phase = 0;
    for (let i = 0; i < n; i++)
    {
        const t = i / RATE;
        const f = freq + (freq2 - freq) * (i / n) + (vibrato ? Math.sin(t * 30) * vibrato : 0);
        phase += f / RATE;
        const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release);
        if (s0 + i < buf.length)
            buf[s0 + i] += WAVES[wave](phase) * vol * env;
    }
}

function noise(buf, start, dur, { vol = 0.3, decay = 8, lowpass = 1 } = {})
{
    const s0 = Math.floor(start * RATE), n = Math.floor(dur * RATE);
    let last = 0;
    for (let i = 0; i < n; i++)
    {
        const t = i / RATE;
        last += (Math.random() * 2 - 1 - last) * lowpass;
        if (s0 + i < buf.length)
            buf[s0 + i] += last * vol * Math.exp(-t * decay);
    }
}

function make(seconds, fn)
{
    const buf = new Float32Array(Math.ceil(seconds * RATE));
    fn(buf);
    return buf;
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "C5", "F#4", "-" FOR A REST
function midi(name)
{
    const m = name.match(/^([A-G])(#|b)?(\d)$/);
    return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] == '#' ? 1 : m[2] == 'b' ? -1 : 0);
}

// A SIMPLE SEQUENCER: EACH TRACK IS A STRING OF "NOTE:LENGTH" STEPS
function song(bpm, tracks, loops = 1)
{
    const beat = 60 / bpm;
    const lengths = tracks.map(t => t.notes.trim().split(/\s+/).reduce((sum, step) => sum + Number(step.split(':')[1] || 1), 0));
    const total = Math.max(...lengths) * beat / 2 * loops;
    return make(total, (buf) => {
        for (const track of tracks)
        {
            let time = 0;
            for (let l = 0; l < loops; l++)
                for (const step of track.notes.trim().split(/\s+/))
                {
                    const [name, len = '1'] = step.split(':');
                    const dur = Number(len) * beat / 2;
                    if (name == 'x')
                        noise(buf, time, Math.min(dur, 0.08), { vol: track.vol, decay: 40 });
                    else if (name != '-')
                        tone(buf, time, dur * 0.92, NOTE(midi(name)), { wave: track.wave, vol: track.vol, release: Math.min(0.08, dur * 0.4), vibrato: track.vibrato || 0 });
                    time += dur;
                }
        }
    });
}

const SFX = {
    sword: make(0.18, b => noise(b, 0, 0.18, { vol: 0.5, decay: 18, lowpass: 0.5 })),
    hit: make(0.12, b => { tone(b, 0, 0.1, 300, { freq2: 120, vol: 0.4 }); noise(b, 0, 0.08, { vol: 0.3, decay: 30 }); }),
    kill: make(0.35, b => { noise(b, 0, 0.35, { vol: 0.6, decay: 10, lowpass: 0.4 }); tone(b, 0, 0.2, 400, { freq2: 60, vol: 0.3 }); }),
    hurt: make(0.3, b => { tone(b, 0, 0.12, 600, { freq2: 300, vol: 0.35 }); tone(b, 0.12, 0.15, 400, { freq2: 150, vol: 0.35 }); }),
    rupee: make(0.2, b => { tone(b, 0, 0.06, NOTE(88), { wave: 'pulse', vol: 0.3 }); tone(b, 0.06, 0.12, NOTE(95), { wave: 'pulse', vol: 0.3 }); }),
    heart: make(0.25, b => { [76, 81, 88].forEach((n, i) => tone(b, i * 0.07, 0.09, NOTE(n), { wave: 'triangle', vol: 0.5 })); }),
    item: make(0.3, b => { [72, 76, 79, 84].forEach((n, i) => tone(b, i * 0.06, 0.1, NOTE(n), { wave: 'pulse', vol: 0.3 })); }),
    fanfare: make(1.3, b => {
        // DA-DA-DA-DAAA
        [[67, 0, .15], [69, .16, .15], [71, .32, .15], [72, .48, .7]].forEach(([n, t, d]) => {
            tone(b, t, d, NOTE(n), { wave: 'square', vol: 0.22 });
            tone(b, t, d, NOTE(n - 12), { wave: 'triangle', vol: 0.35 });
        });
    }),
    secret: make(1.1, b => {
        [79, 78, 75, 69, 68, 76, 80, 84].forEach((n, i) => tone(b, i * 0.11, 0.14, NOTE(n), { wave: 'pulse', vol: 0.25 }));
    }),
    door: make(0.35, b => { noise(b, 0, 0.3, { vol: 0.5, decay: 12, lowpass: 0.15 }); tone(b, 0, 0.25, 110, { freq2: 70, wave: 'triangle', vol: 0.5 }); }),
    bomb: make(0.12, b => tone(b, 0, 0.1, 200, { freq2: 260, wave: 'triangle', vol: 0.4 })),
    explode: make(0.8, b => { noise(b, 0, 0.8, { vol: 0.9, decay: 5, lowpass: 0.25 }); tone(b, 0, 0.4, 90, { freq2: 30, wave: 'triangle', vol: 0.6 }); }),
    arrow: make(0.15, b => { noise(b, 0, 0.12, { vol: 0.35, decay: 25, lowpass: 0.8 }); tone(b, 0, 0.1, 900, { freq2: 500, wave: 'sine', vol: 0.2 }); }),
    fire: make(0.35, b => { noise(b, 0, 0.35, { vol: 0.5, decay: 7, lowpass: 0.2 }); tone(b, 0, 0.3, 200, { freq2: 500, wave: 'saw', vol: 0.12 }); }),
    text: make(0.03, b => tone(b, 0, 0.025, 880, { wave: 'pulse', vol: 0.2, release: 0.01 })),
    menu: make(0.06, b => tone(b, 0, 0.05, 1200, { wave: 'pulse', vol: 0.25, release: 0.02 })),
    select: make(0.15, b => { tone(b, 0, 0.06, 900, { wave: 'pulse', vol: 0.25 }); tone(b, 0.06, 0.08, 1350, { wave: 'pulse', vol: 0.25 }); }),
    splash: make(0.4, b => noise(b, 0, 0.4, { vol: 0.5, decay: 8, lowpass: 0.35 })),
    bossHit: make(0.25, b => { tone(b, 0, 0.22, 220, { freq2: 80, vol: 0.4 }); noise(b, 0, 0.15, { vol: 0.4, decay: 20 }); }),
    bossDie: make(1.8, b => { for (let i = 0; i < 6; i++) noise(b, i * 0.25, 0.5, { vol: 0.6, decay: 6, lowpass: 0.3 }); tone(b, 0, 1.6, 300, { freq2: 40, vol: 0.3 }); }),
    clank: make(0.2, b => { tone(b, 0, 0.18, 1400, { freq2: 1300, wave: 'square', vol: 0.15 }); tone(b, 0, 0.18, 1870, { wave: 'square', vol: 0.1 }); }),
    error: make(0.2, b => tone(b, 0, 0.18, 150, { wave: 'square', vol: 0.3 })),
    die: make(1.2, b => { [72, 71, 70, 69, 68, 67, 60].forEach((n, i) => tone(b, i * 0.14, 0.16, NOTE(n), { wave: 'square', vol: 0.25 })); }),
    stairs: make(0.3, b => { [60, 64, 67].forEach((n, i) => tone(b, i * 0.08, 0.1, NOTE(n), { wave: 'triangle', vol: 0.4 })); }),
};

// LENGTHS ARE IN EIGHTH NOTES
const MUSIC = {
    music_overworld: song(132, [
        { wave: 'pulse', vol: 0.16, vibrato: 3, notes: `
            C5:3 G4:1 G4:2 C5:1 D5:1  E5:2 F5:2 G5:4
            A5:3 G5:1 F5:2 E5:2      D5:2 E5:2 C5:4
            C5:3 G4:1 G4:2 C5:1 D5:1  E5:2 F5:2 G5:4
            A5:2 C6:2 B5:2 G5:2      C6:6 -:2
            F5:3 E5:1 D5:2 C5:2      D5:3 E5:1 F5:4
            E5:3 D5:1 C5:2 B4:2      C5:2 D5:2 G4:4
            F5:3 E5:1 D5:2 C5:2      D5:2 E5:2 F5:2 A5:2
            G5:2 E5:2 D5:2 B4:2      C5:6 -:2` },
        { wave: 'triangle', vol: 0.35, notes: `
            C3:4 G3:4 C3:4 G3:4  F3:4 C4:4 G3:4 C3:4
            C3:4 G3:4 C3:4 G3:4  F3:4 G3:4 C3:4 C3:4
            F3:4 C4:4 F3:4 C4:4  C3:4 G3:4 C3:4 G3:4
            F3:4 C4:4 F3:4 A3:4  G3:4 G3:4 C3:8` },
    ], 2),
    music_dungeon: song(100, [
        { wave: 'square', vol: 0.11, notes: `
            A4:2 C5:2 E5:2 C5:2  D#5:2 B4:2 G#4:4
            A4:2 C5:2 E5:2 A5:2  G#5:4 E5:4
            F5:2 E5:2 D5:2 C5:2  B4:2 C5:2 D5:4
            C5:2 B4:2 A4:2 G#4:2 A4:8` },
        { wave: 'triangle', vol: 0.4, notes: `
            A2:2 A2:2 E3:2 A2:2  G#2:2 G#2:2 E3:2 G#2:2
            A2:2 A2:2 E3:2 A2:2  E2:2 E2:2 B2:2 E2:2
            F2:2 F2:2 C3:2 F2:2  G2:2 G2:2 D3:2 G2:2
            E2:2 E2:2 B2:2 E2:2  A2:2 E2:2 A2:4` },
        { wave: 'square', vol: 0.08, notes: `x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4 x:4` },
    ], 2),
    music_boss: song(150, [
        { wave: 'square', vol: 0.12, notes: `
            E5:1 E5:1 -:1 E5:1 F5:2 E5:2  D#5:1 D#5:1 -:1 D#5:1 E5:2 D#5:2
            E5:1 E5:1 -:1 E5:1 G5:2 F#5:2 B4:4 -:4
            C5:1 C5:1 -:1 C5:1 D5:2 C5:2  B4:1 B4:1 -:1 B4:1 C5:2 B4:2
            A4:2 B4:2 C5:2 D5:2 D#5:4 B4:4` },
        { wave: 'triangle', vol: 0.45, notes: `
            E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1  E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1
            E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1  B1:1 B2:1 B1:1 B2:1 B1:1 B2:1 B1:1 B2:1
            C2:1 C3:1 C2:1 C3:1 C2:1 C3:1 C2:1 C3:1  B1:1 B2:1 B1:1 B2:1 B1:1 B2:1 B1:1 B2:1
            A1:1 A2:1 A1:1 A2:1 A1:1 A2:1 A1:1 A2:1  B1:1 B2:1 B1:1 B2:1 B1:1 B2:1 B1:1 B2:1` },
        { wave: 'square', vol: 0.1, notes: `x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2` },
    ], 2),
    music_title: song(84, [
        { wave: 'pulse', vol: 0.14, vibrato: 4, notes: `
            E5:4 B4:2 E5:2  F#5:2 G5:2 A5:4
            G5:4 F#5:2 E5:2 D5:2 B4:2 E5:4
            C5:4 D5:2 E5:2  B4:4 G4:4
            A4:2 B4:2 C5:2 D5:2 E5:8` },
        { wave: 'triangle', vol: 0.35, notes: `
            E3:8 D3:8 C3:8 B2:8
            A2:8 B2:8 C3:4 D3:4 E3:8` },
    ], 2),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, buf] of Object.entries({ ...SFX, ...MUSIC }))
{
    // NORMALIZE SO NOTHING CLIPS
    let peak = 0;
    for (const s of buf) peak = Math.max(peak, Math.abs(s));
    if (peak > 0.95)
        for (let i = 0; i < buf.length; i++) buf[i] *= 0.95 / peak;
    fs.writeFileSync(path.join(OUT, `${name}.wav`), wav(buf));
}
console.log(`Wrote ${Object.keys(SFX).length} sounds and ${Object.keys(MUSIC).length} music loops to public/sounds/`);
