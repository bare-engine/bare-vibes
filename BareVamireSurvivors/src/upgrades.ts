import { GarlicComponent } from './components/garlicComponent';
import { KnivesComponent } from './components/knivesComponent';
import { LightningComponent } from './components/lightningComponent';
import { MagicWandComponent } from './components/magicWandComponent';
import { OrbitComponent } from './components/orbitComponent';
import type { Game } from './game';
import type { PlayerStats, Weapon } from './weapons/weapon';

export type Upgrade = {
    title: string;
    text: string;
    Apply(): void;
};

type WeaponClass = {
    new (...args: any[]): Weapon;
    title: string;
    maxLevel: number;
    Describe(level: number): string;
};

const WEAPONS: WeaponClass[] = [MagicWandComponent, KnivesComponent, GarlicComponent, OrbitComponent, LightningComponent];

type Passive = {
    title: string;
    text: string;
    max: number;
    Apply(stats: PlayerStats, game: Game): void;
};

const PASSIVES: Record<string, Passive> = {
    might: { title: 'Might', text: '+15% damage', max: 5, Apply: s => s.damage += 0.15 },
    haste: { title: 'Empty Tome', text: '-8% cooldowns', max: 5, Apply: s => s.cooldown *= 0.92 },
    wings: { title: 'Wings', text: '+10% move speed', max: 5, Apply: s => s.speed += 0.1 },
    heart: { title: 'Hollow Heart', text: '+20 max health', max: 5, Apply: (s, g) => { s.maxHp += 20; g.playerComp.Heal(20); } },
    magnet: { title: 'Attractorb', text: '+35% pickup range', max: 5, Apply: s => s.magnet *= 1.35 },
    area: { title: 'Candelabrador', text: '+12% area', max: 5, Apply: s => s.area += 0.12 },
    amount: { title: 'Duplicator', text: '+1 projectile', max: 2, Apply: s => s.amount += 1 },
    regen: { title: 'Pummarola', text: '+0.5 health per second', max: 5, Apply: s => s.regen += 0.5 },
};

const passiveLevels = new WeakMap<Game, Record<string, number>>();

// Up to count random upgrades the player doesn't have maxed out
export function RollUpgrades(game: Game, count = 3): Upgrade[]
{
    const player = game.player;
    const options: Upgrade[] = [];

    for (const weaponClass of WEAPONS)
    {
        const owned = player.GetComponent(weaponClass);
        if (owned)
        {
            if (owned.level < weaponClass.maxLevel)
                options.push({
                    title: `${weaponClass.title} Lv ${owned.level + 1}`,
                    text: weaponClass.Describe(owned.level + 1),
                    Apply: () => owned.LevelUp(),
                });
        }
        else
            options.push({
                title: `${weaponClass.title} (new)`,
                text: weaponClass.Describe(1),
                Apply: () => player.AddComponent(weaponClass),
            });
    }

    let levels = passiveLevels.get(game);
    if (!levels)
        passiveLevels.set(game, levels = {});

    for (const [id, passive] of Object.entries(PASSIVES))
    {
        const level = levels[id] ?? 0;
        if (level < passive.max)
            options.push({
                title: `${passive.title} Lv ${level + 1}`,
                text: passive.text,
                Apply: () => {
                    levels[id] = level + 1;
                    passive.Apply(game.playerStats, game);
                },
            });
    }

    if (options.length === 0)
        options.push({ title: 'Floor Chicken', text: 'Heal 50', Apply: () => game.playerComp.Heal(50) });

    // Shuffle, then take the first few
    for (let i = options.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    return options.slice(0, count);
}
