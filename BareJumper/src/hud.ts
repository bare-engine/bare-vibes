import { Color, Easing, GameObject, Scene, TextObject, TweenTo } from 'bare-engine';
import { FormatTime } from './progress';

const TEXT = {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fill: '#ffffff',
    stroke: '#10122a',
    strokeThickness: 6,
} as const;

export class Hud extends Scene
{
    title!: TextObject;
    timer!: TextObject;
    orbs!: TextObject;
    best!: TextObject;
    prompt!: TextObject;
    banner!: TextObject;
    sub!: TextObject;
    flash!: GameObject;

    constructor()
    {
        super({ UI: true, resize: true });
    }

    override OnStart()
    {
        this.flash = this.AddGameObject('PIXEL').SetScaleXY(bare.width, bare.height);
        this.flash.alpha = 0;

        const pad = 24;
        this.title = this.Text(24).SetPosition(pad, pad);
        this.best = this.Text(18).SetPosition(pad, pad + 34);
        this.timer = this.Text(32).SetPosition(bare.width - pad, pad).SetPivot(1, 0);
        this.orbs = this.Text(24).SetPosition(bare.width - pad, pad + 42).SetPivot(1, 0);
        this.prompt = this.Text(30).SetPosition(bare.width / 2, bare.height * 0.62).CenterPivot();
        this.banner = this.Text(64).SetPosition(bare.width / 2, bare.height * 0.4).CenterPivot();
        this.sub = this.Text(26).SetPosition(bare.width / 2, bare.height * 0.4 + 64).CenterPivot();
        this.banner.visible = this.sub.visible = false;

        TweenTo(this.prompt, 0.7, { alpha: 0.35, ease: Easing.Sinusoidal.InOut, yoyo: true, repeat: -1 });
    }

    private Text(fontSize: number): TextObject
    {
        const text = new TextObject(this, { ...TEXT, text: '', fontSize });
        this.AddGameObject(text);
        return text;
    }

    ShowLevel(title: string, index: number, best?: number)
    {
        this.title.SetText(`${index}. ${title}`);
        this.best.SetText(best != null ? `best ${FormatTime(best)}` : '');
        this.prompt.SetText(bare.mobile ? 'tap to start - tap to flip' : 'SPACE / tap to start, then flip gravity');
        this.prompt.visible = true;
        this.banner.visible = this.sub.visible = false;
        this.SetTime(0);
    }

    HidePrompt()
    {
        this.prompt.visible = false;
    }

    SetTime(seconds: number)
    {
        this.timer.SetText(FormatTime(seconds));
    }

    SetOrbs(have: number, total: number)
    {
        this.orbs.SetText(`orbs ${have}/${total}`);
    }

    ShowBanner(text: string, sub: string)
    {
        this.banner.SetText(text);
        this.sub.SetText(sub);
        this.banner.visible = this.sub.visible = true;
        this.banner.SetScale(0.2);
        TweenTo(this.banner, 0.4, { scaleX: 1, scaleY: 1, ease: Easing.Back.Out });
    }

    Flash(color: Color, seconds: number)
    {
        this.flash.SetScaleXY(bare.width, bare.height);
        this.flash.color = color;
        this.flash.alpha = 0.3;
        TweenTo(this.flash, seconds, { alpha: 0 });
    }
}
