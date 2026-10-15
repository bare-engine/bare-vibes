import { Button, Color, GameObject, Scene, TextObject } from 'bare-engine';
import { LEVEL_COUNT } from '../save';
import type { Level } from './level';
import { Menu } from './menu';
import { GotoLevel } from './navigation';

const FONT = 'Arial';

export function MakeButton(scene: Scene, text: string, onPress: () => void, fontSize = 18, color = '#ffffff'): Button
{
    return new Button(scene, {
        text,
        fontSize,
        fontFamily: FONT,
        fontWeight: 'bold',
        fill: '#000000',
        buttonColor: Color.fromHex(color),
        cornerRadius: 4,
        margin: 8,
        OnPress: onPress,
    });
}

export function MakeText(scene: Scene, text: string, fontSize = 14, fill = '#000000'): TextObject
{
    return new TextObject(scene, { text, fontSize, fontFamily: FONT, fontWeight: 'bold', fill });
}

export class Hud extends Scene
{
    game!: Level;

    private clicksText!: TextObject;
    private checking!: GameObject;
    private checkBar!: GameObject;
    private panel: GameObject | null = null;

    constructor()
    {
        super({ UI: true });
    }

    override OnAwake(payload: { game: Level })
    {
        this.game = payload.game;
    }

    override OnStart()
    {
        const info = this.game.info;

        this.AddGameObject(MakeText(this, info.title)).SetPosition(8, 6);
        this.AddGameObject(MakeText(this, `${this.game.levelNumber}/${LEVEL_COUNT}`)).SetPosition(632, 6).SetPivot(1, 0);

        this.clicksText = this.AddGameObject(MakeText(this, '')).SetPosition(8, 474).SetPivot(0, 1);
        this.UpdateClicks();

        this.AddGameObject(MakeButton(this, 'Menu', () => this.GotoMenu(), 14)).SetPosition(632, 474).SetPivot(1, 1);
        this.AddGameObject(MakeButton(this, 'Retry', () => this.Retry(), 14)).SetPosition(570, 474).SetPivot(1, 1);

        // THE ORIGINAL'S "CHECKING" BAR, SHOWN WHILE IT WAITS FOR EVERYTHING TO SETTLE
        this.checking = this.AddGameObject().SetPosition(8, 430);
        this.checking.AddChild(MakeText(this, 'checking...', 14));
        this.checking.AddChild({ texture: 'PIXEL', color: '#000000' }).SetPosition(0, 20).SetScaleXY(120, 8);
        this.checkBar = this.checking.AddChild({ texture: 'PIXEL', color: '#ff2a2a' }).SetPosition(1, 21).SetScaleXY(0, 6);
        this.checking.visible = false;
    }

    override OnUpdate()
    {
        if (bare.keyboard.IsKeyPressed('r'))
            this.Retry();
        else if (bare.keyboard.IsKeyPressed('escape'))
            this.GotoMenu();
        else if (this.game.state == 'passed' && bare.keyboard.IsKeyPressed('enter'))
            this.Next();

        // CLICKS THAT DON'T HIT A BUTTON GO TO THE LEVEL. THIS SCENE UPDATES AFTER THE LEVEL,
        // SO ITS HITBOXES ARE ALREADY UP TO DATE FOR THIS FRAME
        if (!this.panel && bare.mouse.IsPressed() && !bare.hitbox.GetCurrentHover() && !bare.hitbox.GetCurrentDown())
            this.game.Click();
    }

    UpdateClicks()
    {
        this.clicksText.SetText(`Clicks: ${this.game.clicks}    Par: ${this.game.info.par}`);
    }

    ShowChecking(show: boolean)
    {
        this.checking.visible = show;
    }

    SetCheckProgress(progress: number)
    {
        this.checkBar.SetScaleXY(118 * Math.min(progress, 1), 6);
    }

    ShowPassed()
    {
        this.ShowChecking(false);

        const { clicks } = this.game;
        const par = this.game.info.par;
        const verdict = clicks < par ? 'Under par!' : clicks == par ? 'Par!' : `Par is ${par}`;
        const panel = this.ShowPanel('Level Passed', `${clicks} click${clicks == 1 ? '' : 's'}. ${verdict}`);

        if (this.game.levelNumber < LEVEL_COUNT)
            this.AddPanelButtons(panel, [['Next', () => this.Next()], ['Retry', () => this.Retry()], ['Menu', () => this.GotoMenu()]]);
        else
            this.AddPanelButtons(panel, [['Retry', () => this.Retry()], ['Menu', () => this.GotoMenu()]]);
    }

    ShowFailed()
    {
        this.ShowChecking(false);

        const panel = this.ShowPanel('Level Failed', 'A green shape left the screen');
        this.AddPanelButtons(panel, [['Retry', () => this.Retry()], ['Menu', () => this.GotoMenu()]]);
    }

    private ShowPanel(title: string, message: string): GameObject
    {
        this.AddGameObject({ texture: 'PIXEL', color: '#000000', alpha: 0.25 }).SetScaleXY(640, 480);

        // PANEL WITH A 2 UNIT BLACK BORDER, ITS CHILDREN PLACED FROM ITS TOP LEFT
        const panel = this.AddGameObject().SetPosition(170, 150);
        panel.AddChild({ texture: 'PIXEL', color: '#000000' }).SetScaleXY(300, 160);
        panel.AddChild({ texture: 'PIXEL', color: '#ffffff' }).SetPosition(2, 2).SetScaleXY(296, 156);
        panel.AddChild(MakeText(this, title, 26)).SetPosition(150, 22).SetPivot(0.5, 0);
        panel.AddChild(MakeText(this, message, 15)).SetPosition(150, 62).SetPivot(0.5, 0);

        this.panel = panel;
        return panel;
    }

    private AddPanelButtons(panel: GameObject, buttons: [string, () => void][])
    {
        const spacing = 90;
        const startX = 150 - (buttons.length - 1) * spacing * 0.5;

        buttons.forEach(([text, onPress], i) =>
        {
            panel.AddChild(MakeButton(this, text, onPress, 18, '#dcdcdc')).SetPosition(startX + i * spacing, 125).CenterPivot();
        });
    }

    private Retry()
    {
        GotoLevel(this.game.levelNumber);
    }

    private Next()
    {
        GotoLevel(this.game.levelNumber + 1);
    }

    private GotoMenu()
    {
        bare.scene.Goto(Menu);
    }
}
