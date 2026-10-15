import { GameObject, Vec2 } from 'bare-engine';

export type HitKind = 'sword' | 'arrow' | 'bomb' | 'fire' | 'enemy';

export interface HitInfo
{
    kind: HitKind;
    damage: number;
    // WHERE THE HIT CAME FROM, FOR KNOCKBACK
    from: Vec2;
}

declare module 'bare-engine'
{
    interface Component
    {
        OnHit?(hit: HitInfo): void;
    }
}

export function CanBeHit(obj: GameObject): boolean
{
    return obj.components.some(c => typeof c.OnHit === 'function');
}

export function Hit(obj: GameObject, hit: HitInfo)
{
    obj.scene.component.CallMethodOnComponentsOfObject('OnHit', obj, hit);
}

// THE MIDDLE OF AN OBJECT'S IMAGE, WHEREVER ITS PIVOT IS
export function Center(obj: GameObject): Vec2
{
    return obj.GetCenterPosition();
}

export const DIRS: Record<string, Vec2> = {
    up: new Vec2(0, -1),
    down: new Vec2(0, 1),
    left: new Vec2(-1, 0),
    right: new Vec2(1, 0),
};

export type Facing = 'up' | 'down' | 'left' | 'right';
