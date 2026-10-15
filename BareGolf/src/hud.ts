import { Color, Easing, Scene, TextObject, TweenTo } from 'bare-engine';

const TEXT_STYLE = {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fill: '#ffffff',
    stroke: '#1b2e1e',
    strokeThickness: 5,
};

export class Hud extends Scene
{
    private holeText!: TextObject;
    private strokesText!: TextObject;
    private bestText!: TextObject;
    private hintText!: TextObject;
    private titleText!: TextObject;
    private subText!: TextObject;
    private flashText!: TextObject;

    constructor()
    {
        super({ UI: true, persistent: true });
    }

    override OnStart()
    {
        this.holeText = this.AddText(26);
        this.strokesText = this.AddText(26);
        this.bestText = this.AddText(20);
        this.hintText = this.AddText(16, 'Drag back and let go to shoot  ·  Right-click: cancel  ·  R: retry hole');
        this.titleText = this.AddText(54, '', 'center');
        this.subText = this.AddText(24, '', 'center');
        this.flashText = this.AddText(30, '', 'center');

        this.flashText.fill = Color.fromHex('#9fd8ff');
        this.titleText.fill = Color.fromHex('#ffe066');
        this.titleText.visible = false;
        this.subText.visible = false;
        this.flashText.visible = false;

        this.Layout();
    }

    override OnResize()
    {
        this.Layout();
    }

    private AddText(fontSize: number, text: string = '', align: 'left' | 'center' | 'right' = 'left'): TextObject
    {
        return this.AddGameObject(new TextObject(this, { ...TEXT_STYLE, fontSize, text, align }));
    }

    private Layout()
    {
        const w = bare.width;
        const h = bare.height;

        this.holeText.SetPosition(16, 12).SetPivot(0, 0);
        this.strokesText.SetPosition(w - 16, 12).SetPivot(1, 0);
        this.bestText.SetPosition(w - 16, 46).SetPivot(1, 0);
        this.hintText.SetPosition(w / 2, h - 12).SetPivot(0.5, 1);
        this.titleText.SetPosition(w / 2, h * 0.36).SetPivot(0.5, 0.5);
        this.subText.SetPosition(w / 2, h * 0.36 + 64).SetPivot(0.5, 0);
        this.flashText.SetPosition(w / 2, h * 0.22).SetPivot(0.5, 0.5);
    }

    ShowHole(holeNumber: number, holeCount: number, par: number, best: number | undefined)
    {
        this.holeText.SetText(`Hole ${holeNumber}/${holeCount}   Par ${par}`);
        this.bestText.SetText(best ? `Best ${best}  ${Hud.Stars(Hud.StarCount(best, par))}` : '');
        this.titleText.visible = false;
        this.subText.visible = false;
        this.Layout();
    }

    ShowStrokes(strokes: number)
    {
        this.strokesText.SetText(`Strokes ${strokes}`);
        this.Layout();
    }

    ShowResult(title: string, lines: string)
    {
        this.titleText.SetText(title);
        this.subText.SetText(lines);
        this.titleText.visible = true;
        this.subText.visible = true;
        this.Layout();

        this.titleText.SetScale(0.3);
        TweenTo(this.titleText, 0.5, { scaleX: 1, scaleY: 1, ease: Easing.Back.Out });
    }

    Flash(text: string)
    {
        this.flashText.SetText(text);
        this.flashText.visible = true;
        this.flashText.alpha = 1;
        this.Layout();
        TweenTo(this.flashText, 0.6, { alpha: 0, delay: 1 })
            .promise.then(() => this.flashText.visible = false);
    }

    // 3 stars at or under par, 2 up to two over, 1 for finishing
    static StarCount(strokes: number, par: number): number
    {
        if (strokes <= par)
            return 3;

        return strokes <= par + 2 ? 2 : 1;
    }

    static Stars(count: number): string
    {
        return '★'.repeat(count) + '☆'.repeat(3 - count);
    }
}
