import { GameObject, Scene, Shader } from 'bare-engine';
import { GHOST_STEP } from './progress';

// A PALE, PULSING SILHOUETTE
export class GhostShader extends Shader
{
    time = 0;

    constructor()
    {
        super(`
            void vertex(inout vec4 position, inout vec2 region) {
            }
        `, `
            uniform highp float uTime;
            void fragment(inout vec4 color, vec2 vRegion) {
                float a = color.a * (0.35 + 0.12 * sin(uTime * 6.0));
                color = vec4(vec3(0.7, 0.85, 1.0) * a, a);
            }
        `);
        this.SetUniforms({ uTime: 0 });
    }

    override Update()
    {
        this.time += bare.deltaTime;
        this.SetUniforms({ uTime: this.time });
        return false;
    }
}

// REPLAYS THE BEST RUN: SAMPLES OF x, y, gravity direction, ONE EVERY GHOST_STEP FIXED UPDATES
export class Ghost
{
    go: GameObject;
    private step = 0;

    constructor(scene: Scene, private samples: number[])
    {
        this.go = scene.AddGameObject('/player', 'effects').CenterPivot();
        this.go.AddShader(GhostShader);
        this.Place(0);
    }

    Advance()
    {
        this.step++;
        this.Place(this.step / GHOST_STEP);
    }

    private Place(t: number)
    {
        const count = this.samples.length / 3;
        if (count == 0)
            return;

        const i = Math.min(Math.floor(t), count - 1);
        const j = Math.min(i + 1, count - 1);
        const f = Math.min(t - i, 1);
        const s = this.samples;

        this.go.x = s[i * 3] + (s[j * 3] - s[i * 3]) * f;
        this.go.y = s[i * 3 + 1] + (s[j * 3 + 1] - s[i * 3 + 1]) * f;
        this.go.innerScaleY = s[i * 3 + 2];
        this.go.visible = t < count;
    }
}
