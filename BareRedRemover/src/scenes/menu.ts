import { Button, SaveData, Scene } from 'bare-engine';
import { IsLevelOpen, LEVEL_COUNT } from '../save';
import { MakeButton, MakeText } from './hud';
import { GotoLevel } from './navigation';

// LEVEL TITLES, SO THE MENU DOESN'T HAVE TO LOAD EVERY LEVEL FILE
const TITLES = ['Tutorial: Red Shapes', 'Tutorial: Dark Red Shapes', 'Tutorial: Green Shapes', 'Tiimmbbeerr!', "Rollin'", 'Tutorial: Gravity'];
const PARS = [3, 3, 3, 2, 1, 2];

let musicStarted = false;
import settingsData from '../../public/data/settingsData.json';

export class Menu extends Scene
{
    private musicButton!: Button;

    constructor()
    {
        super({ settingsData: settingsData, UI: true });
    }

    override OnStart()
    {
        this.AddGameObject('bg/d').SetScale(0.5);
        this.AddGameObject('title').SetScale(0.5).SetPosition(320, 70).CenterPivot();

        for (let i = 1; i <= LEVEL_COUNT; i++)
            this.AddLevelButton(i, 145 + (i - 1) * 44);

        this.musicButton = this.AddGameObject(MakeButton(this, '', () => this.ToggleMusic(), 12)).SetPosition(632, 474).SetPivot(1, 1);
        this.UpdateMusicButton();

        const help = 'Click shapes to remove them. Remove every red shape, keep every green one on screen.';
        this.AddGameObject(MakeText(this, help, 12, '#ffffff')).SetPosition(8, 474).SetPivot(0, 1);
    }

    override OnUpdate()
    {
        // BROWSERS ONLY ALLOW AUDIO AFTER THE FIRST CLICK
        if (!musicStarted && SaveData.musicEnabled && bare.mouse.IsPressed())
        {
            musicStarted = true;
            bare.sound.Play('music', { loop: true, volume: 0.5 });
        }

        // DEV ONLY: NUMBER KEYS OPEN ANY LEVEL, LOCKED OR NOT
        if (isDev)
            for (let i = 1; i <= LEVEL_COUNT; i++)
                if (bare.keyboard.IsKeyPressed(String(i)))
                    GotoLevel(i);
    }

    private AddLevelButton(level: number, y: number)
    {
        const best = SaveData.bestClicks[level];
        const open = IsLevelOpen(level);

        let label = `${level}. ${TITLES[level - 1]}`;
        if (best !== undefined)
            label += best <= PARS[level - 1] ? `  ★ ${best}` : `  ✓ ${best}`;

        const button = this.AddGameObject(MakeButton(this, label, () => open && GotoLevel(level), 18))
            .SetPosition(320, y)
            .CenterPivot();

        if (!open)
            button.alpha = 0.45;
    }

    private ToggleMusic()
    {
        SaveData.musicEnabled = !SaveData.musicEnabled;
        bare.storage.Save();

        if (SaveData.musicEnabled)
        {
            musicStarted = true;
            bare.sound.Play('music', { loop: true, volume: 0.5 });
        }
        else
        {
            bare.sound.Stop('music');
        }

        this.UpdateMusicButton();
    }

    private UpdateMusicButton()
    {
        this.musicButton.text = SaveData.musicEnabled ? 'Music: on' : 'Music: off';
    }
}
