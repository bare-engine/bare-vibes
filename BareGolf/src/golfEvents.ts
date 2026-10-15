import type { GameObject } from 'bare-engine';

declare module 'bare-engine'
{
    interface BareUserEvents
    {
        ballShot: void;
        ballSunk: void;
        ballInWater: void;
    }
}

// true when a point lies inside an object's world bounds, shrunk by inset on every side
export function ContainsPoint(go: GameObject, x: number, y: number, inset: number = 0): boolean
{
    const b = go.GetBounds();

    return x >= b.x + inset && x <= b.x + b.width - inset
        && y >= b.y + inset && y <= b.y + b.height - inset;
}
