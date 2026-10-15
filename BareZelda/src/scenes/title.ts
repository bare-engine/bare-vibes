import { Color, GameObject, SaveData, Scene, TextObject } from 'bare-engine';
import { Music, Sfx } from '../game/sfx';
import { FONT } from './hud';
import { World } from './world';

export class Title extends Scene
{
    private background!: GameObject;
    private options: TextObject[] = [];
    private choices: { label: string; run: () => void }[] = [];
    private index = 0;
    private chosen = false;
    private time = 0;

    constructor()
    {
        super({ UI: true });
    }

    override OnStart()
    {
        this.background = this.AddGameObject('maps/overworld').SetPosition(0, 0);

        const text = (x: number, y: number, s: string, size: number, fill: string, stroke = 2) => {
            const t = new TextObject(this, { text: s, fontSize: size, fontFamily: FONT, fontWeight: 'bold', fill, stroke: '#1a1c2c', strokeThickness: stroke });
            this.AddGameObject(t).SetPosition(x, y).SetPivot(0.5, 0.5);
            return t;
        };

        text(160, 42, 'SIGIL QUEST', 26, '#ffcd75', 4);
        text(160, 66, 'The Five Sigils of Elmore', 9, '#f4f4f4');

        if (SaveData.hasSave)
            this.choices.push({ label: 'Continue', run: () => this.Begin(false) });
        this.choices.push({ label: 'New Game', run: () => this.Begin(true) });

        this.choices.forEach((c, i) => this.options.push(text(160, 104 + i * 16, c.label, 10, '#f4f4f4')));

        text(160, 160, 'ARROWS/WASD move   SPACE sword/talk   K item   Q/E switch   ENTER bag', 6, '#94b0c2');
        text(160, 170, 'Made with Bare Engine', 6, '#566c86');
        this.Refresh();
    }

    private Refresh()
    {
        this.options.forEach((t, i) => {
            t.SetText((i == this.index ? '> ' : '') + this.choices[i].label + (i == this.index ? ' <' : ''));
            t.textTexture.style = { fill: i == this.index ? '#ffcd75' : '#f4f4f4' };
        });
    }

    private async Begin(fresh: boolean)
    {
        if (this.chosen)
            return;
        this.chosen = true;
        Sfx('select', 0.5);
        if (fresh)
            bare.storage.Clear();
        await bare.scene.Goto(World);
    }

    override OnUpdate(deltaTime: number)
    {
        this.time += deltaTime;
        // SLOWLY PAN OVER THE OVERWORLD
        const w = this.background.width - bare.width, h = this.background.height - bare.height;
        if (w > 0)
        {
            this.background.x = -(Math.sin(this.time * 0.05) * 0.5 + 0.5) * w;
            this.background.y = -(Math.cos(this.time * 0.035) * 0.5 + 0.5) * h;
        }

        const kb = bare.keyboard;
        if (kb.GetKeysPressed().length > 0)
            Music('music_title');

        const prev = this.index;
        if (kb.IsUpPressed()) this.index = (this.index + this.choices.length - 1) % this.choices.length;
        if (kb.IsDownPressed()) this.index = (this.index + 1) % this.choices.length;
        if (prev != this.index)
        {
            Sfx('menu', 0.4);
            this.Refresh();
        }
        if (kb.IsKeyPressed('enter') || kb.IsKeyPressed('space'))
            this.choices[this.index].run();
    }

    override OnPreRender()
    {
        bare.drawRect({ x: 0, y: 0, width: bare.width, height: bare.height, color: Color.fromHex('#0e0e1680') });
    }
}
