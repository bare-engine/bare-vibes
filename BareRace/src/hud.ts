import { Color, GameObject, Scene, TextObject } from 'bare-engine';
import { LAPS, type RaceManager } from './race';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];

function FormatTime(seconds: number): string
{
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

export class Hud extends Scene
{
    race?: RaceManager;

    private lap!: TextObject;
    private position!: TextObject;
    private time!: TextObject;
    private speed!: TextObject;
    private standings!: TextObject;
    private countdown!: TextObject;
    private results!: TextObject;
    private resultsPanel!: GameObject;

    constructor()
    {
        super({ UI: true });
    }

    private AddText(fontSize: number, align: 'left' | 'center' | 'right' = 'left'): TextObject
    {
        return this.AddGameObject(new TextObject(this, {
            text: '',
            fontSize,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#1d2b36',
            strokeThickness: Math.max(3, fontSize / 8),
            align,
            lineHeight: 1.25,
        }));
    }

    override OnStart()
    {
        this.lap = this.AddText(34);
        this.position = this.AddText(54);
        this.time = this.AddText(30).SetPivot(1, 0);
        this.speed = this.AddText(30).SetPivot(1, 1);
        this.standings = this.AddText(20);

        this.resultsPanel = this.AddGameObject('PIXEL').SetColor(new Color(20, 30, 40, 200)).CenterPivot();
        this.results = this.AddText(30, 'center');
        this.countdown = this.AddText(140).CenterPivot();
    }

    override OnUpdate()
    {
        const race = this.race;
        if (!race?.player)
            return;

        const margin = 20;
        const player = race.player;

        this.lap.SetText(`LAP ${player.racer.lap}/${LAPS}`).SetPosition(margin, margin);
        this.position.SetText(`${ORDINALS[race.GetPosition(player.racer) - 1]}`).SetPosition(margin, margin + 40);
        this.time.SetText(FormatTime(player.racer.finishTime ?? race.raceTime)).SetPosition(bare.width - margin, margin);

        // 8 game units to a meter gives these cars a believable top speed
        this.speed.SetText(`${Math.round(player.car.speed / 8 * 3.6)} km/h`).SetPosition(bare.width - margin, bare.height - margin);

        this.standings
            .SetText(race.GetStandings().map((r, i) => `${i + 1}. ${r.driver}`).join('\n'))
            .SetPosition(margin, margin + 120);

        this.UpdateCountdown(race);
        this.UpdateResults(race);
    }

    private UpdateCountdown(race: RaceManager)
    {
        const showGo = race.state != 'countdown' && race.raceTime < 0.8;
        this.countdown.visible = race.state == 'countdown' || showGo;
        if (!this.countdown.visible)
            return;

        this.countdown
            .SetText(showGo ? 'GO!' : `${Math.ceil(race.countdown)}`)
            .SetColor(showGo ? Color.Lime : Color.White)
            .CenterPivot()
            .SetPosition(bare.width / 2, bare.height * 0.22);
    }

    private UpdateResults(race: RaceManager)
    {
        const show = race.state == 'finished';
        this.results.visible = show;
        this.resultsPanel.visible = show;
        if (!show)
            return;

        const lines = race.GetStandings().map((r, i) =>
            `${ORDINALS[i]}   ${r.driver}   ${r.finished ? FormatTime(r.finishTime!) : '--:--.--'}`);
        const place = race.GetPosition(race.player.racer);

        this.results
            .SetText([place == 1 ? 'YOU WIN!' : `You finished ${ORDINALS[place - 1]}`, '', ...lines, '', 'Press Enter to race again'].join('\n'))
            .CenterPivot()
            .SetPosition(bare.width / 2, bare.height / 2);

        const box = this.results.GetBounds();
        this.resultsPanel
            .SetScaleXY(box.width + 80, box.height + 60)
            .SetPosition(bare.width / 2, bare.height / 2);
    }
}
