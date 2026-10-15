import { SaveData, Scene, TextObject } from 'bare-engine';
import { Music, Sfx } from '../game/sfx';
import { FONT } from './hud';
import { Title } from './title';

export class Ending extends Scene
{
    private credits!: TextObject;
    private time = 0;

    constructor()
    {
        super({ UI: true });
    }

    override OnStart()
    {
        Music('music_title');
        const minutes = Math.floor(SaveData.playTime / 60);
        const lines = [
            'THE END',
            '',
            'The Dark Lord is no more.',
            'The five sigils shine over Elmore,',
            'and the shadow fades from the land.',
            '',
            'Mina and Whiskers, Old Tom, Bram, Pip,',
            'and Elder Rowan will tell your tale',
            'for a hundred years.',
            '',
            `Hearts: ${SaveData.maxHp / 2}   Rupees: ${SaveData.rupees}`,
            `Time: ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
            '',
            'Thank you for playing!',
            '',
            'Press ENTER',
        ];
        this.credits = new TextObject(this, { text: lines.join('\n'), fontSize: 8, fontFamily: FONT, fontWeight: 'bold', fill: '#f4f4f4', stroke: '#1a1c2c', strokeThickness: 2, align: 'center', lineHeight: 1.25 });
        this.AddGameObject(this.credits).SetPivot(0.5, 0).SetPosition(160, 190);
    }

    override OnUpdate(deltaTime: number)
    {
        this.time += deltaTime;
        this.credits.y = Math.max(8, 190 - this.time * 18);
        if (this.time > 2 && (bare.keyboard.IsKeyPressed('enter') || bare.keyboard.IsKeyPressed('space')))
        {
            Sfx('select', 0.5);
            bare.scene.Goto(Title);
        }
    }
}
