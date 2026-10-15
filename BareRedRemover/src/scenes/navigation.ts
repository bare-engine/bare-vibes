import { Level } from './level';

export function GotoLevel(level: number)
{
    bare.scene.Goto(Level, { level });
}
