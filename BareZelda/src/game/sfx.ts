// SOUNDS ARE GENERATED .wav FILES IN public/sounds/ (SEE tools/sfx.cjs). THE ENGINE LOOKS FOR <name>.mp3
// BY DEFAULT, SO EVERY SOUND IS REGISTERED WITH ITS FILE NAME ONCE AT STARTUP.

export const SOUNDS = [
    'sword', 'hit', 'kill', 'hurt', 'rupee', 'heart', 'item', 'fanfare', 'secret', 'door', 'bomb', 'explode',
    'arrow', 'fire', 'text', 'menu', 'select', 'splash', 'bossHit', 'bossDie', 'clank', 'error', 'die', 'stairs',
    'music_overworld', 'music_dungeon', 'music_boss', 'music_title',
] as const;

export type SoundName = typeof SOUNDS[number];

export function RegisterSounds()
{
    for (const name of SOUNDS)
        bare.sound.Register(name, `${name}.wav`);
}

export function Sfx(name: SoundName, volume = 0.5)
{
    bare.sound.Play(name, { volume });
}

let currentMusic: SoundName | null = null;

export function Music(name: SoundName | null)
{
    if (name == currentMusic)
        return;
    if (currentMusic)
        bare.sound.Stop(currentMusic);
    currentMusic = name;
    if (name)
        bare.sound.Play(name, { loop: true, volume: 0.28 });
}
