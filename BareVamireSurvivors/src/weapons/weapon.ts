import { Component } from 'bare-engine';
import type { ArcadeObject } from 'bare-engine/arcade';
import type { Game } from '../game';

// Stats the passive upgrades change, read by every weapon
export class PlayerStats
{
    damage = 1;
    cooldown = 1;
    area = 1;
    amount = 0;
    speed = 1;
    magnet = 90;
    maxHp = 100;
    regen = 0;
}

// Base for the weapon components on the player. Not named ...Component, so the engine
// doesn't register it as one.
export abstract class Weapon extends Component<ArcadeObject>
{
    level = 1;
    protected cooldownLeft = 0.3;

    get game(): Game
    {
        return this.scene as Game;
    }

    get stats(): PlayerStats
    {
        return this.game.playerStats;
    }

    // Seconds between attacks at the current level, before the cooldown upgrade
    protected abstract get cooldown(): number;

    // Returns false when there was nothing to attack, to try again soon
    protected abstract Fire(): boolean;

    override OnFixedUpdate(dt: number)
    {
        if (!this.game.weaponsEnabled)
            return;

        this.cooldownLeft -= dt;
        if (this.cooldownLeft > 0)
            return;

        this.cooldownLeft = this.Fire() ? this.cooldown * this.stats.cooldown : 0.1;
    }

    LevelUp()
    {
        this.level++;
        this.OnLevelChanged();
    }

    protected OnLevelChanged() {}
}
