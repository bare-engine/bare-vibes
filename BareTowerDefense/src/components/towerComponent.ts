import { Color, Component, GameObject, Inspector, InspectorButton, InspectorField, SerializeField, Vec2 } from 'bare-engine';
import type { Game } from '../game';
import { EnemyComponent } from './enemyComponent';
import { ProjectileComponent } from './projectileComponent';

export const MAX_TOWER_LEVEL = 4;

const PIP_COLOR = Color.fromHex('#ffd84a');
const PIP_BACK = Color.fromHex('#00000099');

export class TowerComponent extends Component
{
    @SerializeField
    displayName = 'Tower';

    @SerializeField @Inspector.Limit(0, Infinity)
    cost = 50;

    @SerializeField @Inspector.Limit(0, Infinity)
    range = 150;

    @SerializeField @Inspector.Label('Shots per second')
    fireRate = 1;

    @SerializeField
    damage = 10;

    @SerializeField @Inspector.Description('Radius of the area damage, 0 for a single target')
    splash = 0;

    @SerializeField @Inspector.Description('Speed multiplier for hit enemies, 0 for no slow')
    slow = 0;

    @SerializeField
    slowDuration = 0;

    @SerializeField
    projectile = '';

    @InspectorField
    level = 1;

    @InspectorField
    spent = 0;

    private cooldown = 0;
    private head: GameObject | null = null;

    get game(): Game { return this.scene as Game; }
    get upgradeCost(): number { return Math.round(this.cost * 0.8 * this.level); }
    get sellValue(): number { return Math.floor(this.spent * 0.7); }
    get canUpgrade(): boolean { return this.level < MAX_TOWER_LEVEL; }

    override OnStart()
    {
        this.head = this.go.GetChildByName('head');
        this.spent = this.cost;
    }

    @InspectorButton
    Upgrade()
    {
        this.spent += this.upgradeCost;
        this.level++;
        this.damage = Math.round(this.damage * 1.45 * 10) / 10;
        this.range += 12;
        this.fireRate *= 1.12;

        if (this.head)
            this.head.SetScale(1 + (this.level - 1) * 0.08);
    }

    override OnFixedUpdate(dt: number)
    {
        if (this.game.isGameOver)
            return;

        this.cooldown -= dt;

        const target = this.FindTarget();
        if (!target)
            return;

        if (this.head)
            this.head.rotation = bare.util.Direction(this.go.position, target.go.position);

        if (this.cooldown <= 0)
        {
            this.cooldown = 1 / this.fireRate;
            this.Fire(target);
        }
    }

    // THE ENEMY IN RANGE THAT WALKED FURTHEST ALONG THE PATH
    private FindTarget(): EnemyComponent | null
    {
        let best: EnemyComponent | null = null;
        const rangeSquared = this.range * this.range;

        for (const enemy of bare.component.GetAllByType(EnemyComponent))
        {
            if (!enemy.alive)
                continue;

            const dx = enemy.go.x - this.go.x;
            const dy = enemy.go.y - this.go.y;
            if (dx * dx + dy * dy <= rangeSquared && (!best || enemy.progress > best.progress))
                best = enemy;
        }

        return best;
    }

    private Fire(target: EnemyComponent)
    {
        const shot = this.scene.AddGameObject(this.projectile, 'projectiles').SetPosition(this.go.x, this.go.y);
        shot.GetComponent(ProjectileComponent)?.Launch(target, this.damage, this.splash, this.slow, this.slowDuration);

        if (this.head)
            bare.tween.Shake(this.head, 'innerX', 0.15, -4, 6, 2);
    }

    override OnPostRender()
    {
        // ONE PIP PER LEVEL BELOW THE TOWER
        const size = 6, gap = 3;
        const total = MAX_TOWER_LEVEL * size + (MAX_TOWER_LEVEL - 1) * gap;
        const x = this.go.x - total / 2;
        const y = this.go.y + 20;

        bare.drawRect({ position: new Vec2(x - 2, y - 2), width: total + 4, height: size + 4, color: PIP_BACK });
        for (let i = 0; i < this.level; i++)
            bare.drawRect({ position: new Vec2(x + i * (size + gap), y), width: size, height: size, color: PIP_COLOR });
    }
}
