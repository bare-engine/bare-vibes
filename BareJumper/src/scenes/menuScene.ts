import { Button, Color, Easing, Scene, TextObject, TweenTo } from 'bare-engine';
import { SaveData } from 'bare-engine';
import { FormatTime, GetRecord, InitProgress, LEVELS } from '../progress';
import { RunScene } from './runScene';

const TITLES = ['First Flip', 'Mind the Gap', 'Zipper', 'Islands', 'Gauntlet'];

export class MenuScene extends Scene
{
    constructor()
    {
        super({ UI: true, resize: true });
    }

    override OnStart(payload?: { finished?: boolean })
    {
        InitProgress();

        const title = this.AddGameObject(new TextObject(this, {
            text: 'FLIPSIDE',
            fontSize: 96,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fill: '#3ee0ff',
            stroke: '#10122a',
            strokeThickness: 10,
        })).SetPosition(bare.width / 2, 110).CenterPivot();
        TweenTo(title, 1.2, { innerScaleY: -1, ease: Easing.Back.InOut, yoyo: true, repeat: -1, delay: 1.5 });

        const subtitle = payload?.finished ? 'You beat every level! Chase those ghosts.' : 'Run. Flip gravity. Don\'t touch the red stuff.';
        this.AddGameObject(this.Label(subtitle, 24, '#ffffff')).SetPosition(bare.width / 2, 190).CenterPivot();

        LEVELS.forEach((level, i) =>
        {
            const locked = i + 1 > SaveData.unlocked;
            const record = GetRecord(level);
            const stats = record ? `   ${FormatTime(record.bestTime)}   orbs ${record.orbs}/${record.orbsTotal}` : '';

            const button = new Button(this, {
                text: locked ? `${i + 1}. locked` : `${i + 1}. ${TITLES[i]}${stats}`,
                fontSize: 26,
                fontFamily: 'monospace',
                buttonColor: Color.fromHex(locked ? '#2a2d45' : record ? '#2f7a5c' : '#3a4ab8'),
                cornerRadius: 10,
                margin: 14,
                OnPress: () => { if (!locked) bare.scene.Goto(RunScene, { level }); },
            });
            this.AddGameObject(button).SetPosition(bare.width / 2, 270 + i * 74).CenterPivot();
            if (locked)
                button.alpha = 0.6;
        });

        const sound = new Button(this, {
            text: SaveData.soundEnabled ? 'sound on' : 'sound off',
            fontSize: 18,
            fontFamily: 'monospace',
            buttonColor: Color.fromHex('#2a2d45'),
            cornerRadius: 8,
            margin: 10,
            OnPress: () =>
            {
                SaveData.soundEnabled = !SaveData.soundEnabled;
                bare.storage.Save();
                sound.SetText(SaveData.soundEnabled ? 'sound on' : 'sound off');
            },
        });
        this.AddGameObject(sound).SetPosition(bare.width - 20, 20).SetPivot(1, 0);

        const help = bare.mobile ? 'tap to flip' : 'SPACE / arrows / click to flip   -   ESC for menu';
        this.AddGameObject(this.Label(`${help}   -   deaths ${SaveData.deaths}`, 18, '#9aa3d8')).SetPosition(bare.width / 2, bare.height - 40).CenterPivot();
    }

    private Label(text: string, fontSize: number, fill: string): TextObject
    {
        return new TextObject(this, { text, fontSize, fill, fontFamily: 'monospace' });
    }
}
