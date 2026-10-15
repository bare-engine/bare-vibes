import { ParticleEmitter, Vec2 } from 'bare-engine';
import { World } from '../scenes/world';

// ONE EMITTER PER EFFECT AND SCENE, REUSED FOR EVERY BURST
const emitters = new WeakMap<World, Map<string, ParticleEmitter>>();

type Effect = 'puff' | 'sparks' | 'explosion' | 'magic' | 'splash' | 'leaves' | 'fire';

const EFFECTS: Record<Effect, any> = {
    puff: {
        texture: 'puff', life: [0.3, 0.5], emitRate: 8, emitShape: 'CIRCLE', emitRadius: 4, origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [0.6, 1], end: 0.1 }, speed: { start: [20, 50], damping: 0.9 }, color: { start: '#ffffffd0', end: '#ffffff00' } },
    },
    sparks: {
        texture: 'spark', life: [0.2, 0.35], emitRate: 6, emitShape: 'POINT', origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [0.6, 1], end: 0.1 }, speed: { start: [60, 110] }, color: { start: '#ffffff', end: '#ffcd7500' } },
    },
    explosion: {
        texture: 'puff', life: [0.35, 0.6], emitRate: 22, emitShape: 'CIRCLE', emitRadius: 6, origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [1, 1.8], end: 0.2 }, speed: { start: [50, 110], damping: 0.88 }, color: { start: '#ffcd75', end: '#b13e5300' } },
    },
    magic: {
        texture: 'spark', life: [0.4, 0.7], emitRate: 14, emitShape: 'CIRCLE', emitRadius: 8, origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [0.8, 1.2], end: 0.1 }, speed: { start: [20, 60] }, color: { start: '#f4f4f4', end: '#9a5bc000' } },
    },
    splash: {
        texture: 'spark', life: [0.25, 0.4], emitRate: 8, emitShape: 'POINT', origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [0.5, 0.9], end: 0.1 }, speed: { start: [40, 80] }, velocity: { delta: { x: 0, y: 260 } }, color: { start: '#9fd4ff', end: '#41a6f600' } },
    },
    leaves: {
        texture: 'spark', life: [0.3, 0.55], emitRate: 9, emitShape: 'CIRCLE', emitRadius: 4, origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [0.6, 1], end: 0.2 }, speed: { start: [40, 90], damping: 0.9 }, color: { start: '#5cc068', end: '#1f6b4500' } },
    },
    fire: {
        texture: 'puff', life: [0.3, 0.5], emitRate: 10, emitShape: 'CIRCLE', emitRadius: 5, origin: { x: 0.5, y: 0.5 },
        animation: { scale: { start: [0.6, 1.1], end: 0.1 }, speed: { start: [20, 50] }, velocity: { delta: { x: 0, y: -120 } }, color: { start: '#ffcd75', end: '#b13e5300' } },
    },
};

export function Burst(scene: World, effect: Effect, position: Vec2)
{
    let map = emitters.get(scene);
    if (!map)
        emitters.set(scene, map = new Map());

    let emitter = map.get(effect);
    if (!emitter)
        map.set(effect, emitter = scene.particle.CreateEmitter(EFFECTS[effect]));

    scene.particle.OneShot(emitter, { position });
}
