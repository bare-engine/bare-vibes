import { Component, GameObject, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { CanBeHit, Center, Hit, HitKind } from '../game/hit';
import { World } from '../scenes/world';

// ARROWS, FIREBALLS AND ENEMY SHOTS. FLIES UNTIL IT HITS SOMETHING SOLID OR SOMETHING IT CAN HURT
export class ProjectileComponent extends Component<ArcadeObject>
{
    @SerializeField kind: HitKind = 'arrow';
    @SerializeField owner: 'player' | 'enemy' = 'player';
    @SerializeField damage = 1;
    @SerializeField life = 1.6;

    private age = 0;
    private done = false;

    override OnFixedUpdate(dt: number)
    {
        this.age += dt;
        if (this.age > this.life)
            this.Finish(false);
    }

    override OnCollisionStart(other: GameObject)
    {
        if (this.done)
            return;

        // FLY OVER WATER, IGNORE OTHER SHOTS, PICKUPS AND WARPS
        if (other.tags.includes('water') || other.HasComponent(ProjectileComponent))
            return;

        const world = World.instance;
        const isPlayer = other === world.player;
        const solid = other instanceof ArcadeObject && other.static && !other.sensor;

        // ENEMY SHOTS FLY THROUGH OTHER ENEMIES, WHICH AREN'T STATIC
        if (this.owner == 'enemy')
        {
            if (isPlayer)
            {
                world.pc.Hurt(this.damage, Center(this.go));
                this.Finish(true);
            }
            else if (solid)
                this.Finish(true);
            return;
        }

        if (isPlayer)
            return;
        if (CanBeHit(other))
        {
            Hit(other, { kind: this.kind, damage: this.damage, from: Center(this.go) });
            this.Finish(true);
        }
        else if (solid)
            this.Finish(true);
    }

    private Finish(impact: boolean)
    {
        if (this.done)
            return;
        this.done = true;
        if (impact)
            Burst(World.instance, this.kind == 'fire' ? 'fire' : 'sparks', Center(this.go));
        this.go.Remove();
    }
}
