import { Button, GameObject, Scene, StartBare, TextObject } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { Choice, Outcome, PayoffMatrix } from './payoffMatrix';
import { Peep } from './peep';

export class Game extends Scene
{
    static readonly LABEL_COLOR = "#000000";
    static readonly LABEL_HIGHLIGHT = "#FFE663";

    payoff!: GameObject;
    payoffHighlight!: GameObject;
    player!: Peep;
    opponent!: Peep;
    playingRound: boolean = false;

    buttonCooperate!: GameObject;
    buttonCheat!: GameObject;

    scoreTextPlayer!: TextObject;
    scoreTextOpponent!: TextObject;

    scorePlayer: int = 0;
    scoreOpponent: int = 0;
    
    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override OnAwake()
    {
        bare.AddClass(TextObject);
        bare.AddClass(Button);
    }

    override OnStart()
    {
        // TABLE TO CONTAIN THE OBJECTS
        var stageScale = Math.min(1, bare.width * .95 / 1400);
        var table = this.AddGameObject()
            .SetPosition(bare.width * .5, bare.height * .5)
            .SetScale(stageScale);

        // PEEPS FIRST, SO THEIR COINS GO BEHIND THE MACHINE
        this.player = table.AddChild<Peep>(Peep).Build()
            .SetPosition(-576, 222)
            .SetScale(2);

        this.opponent = table.AddChild<Peep>(Peep).Build()
            .SetPosition(576, 222)
            .SetScaleXY(-2, 2);

        table.AddChild("iterated_machine")
            .SetName("machine")
            .SetPosition(-700, -250);

        // BEHIND THE DIAMOND, SO ITS LINES AND NUMBERS DRAW OVER THE YELLOW
        this.payoffHighlight = table.AddChild("payoffs_highlightReward")
            .SetName("payoffHighlight")
            .CenterPivot();
        this.payoffHighlight.visible = false;

        this.payoff = table.AddChild('payoff')
            .CenterPivot();

        this.buttonCooperate = this.AddGameObject<Button>({text: "Cooperate", extends: "button"})
            .SetPosition(bare.width * .35, bare.height * .1)
            .MakeInteractive(()=>{
                this.PickedOption(Choice.Cooperate);
            })

        this.buttonCheat = this.AddGameObject<Button>({text: "Cheat", extends: "button"})
            .SetPosition(bare.width * .65, bare.height * .1)
            .MakeInteractive(()=>{
                this.PickedOption(Choice.Cheat);
            })

        this.AssignPayoffValues();

        // SETUP UI - SCORES
        bare.uiScene.resize = true;
        var marge = 40;

        this.scoreTextPlayer = bare.uiScene.AddGameObject<TextObject>({text: this.scorePlayer.toString(), baseClass: "TextObject", fontSize: 60, fill: "#000"})
            .SetPosition(marge, marge)
            .CenterPivot();

        this.scoreTextOpponent = bare.uiScene.AddGameObject<TextObject>({text: this.scoreOpponent.toString(), baseClass: "TextObject", fontSize: 60, fill: "#000"})
            .SetPosition(bare.width - marge, marge)
            .CenterPivot();
    }

    async PickedOption(choice: Choice)
    {
        if (this.playingRound)
            return;

        this.playingRound = true;

        var theirChoice = Choice.Random();

        // LIGHT UP THE CELL ONCE THE COINS ARE IN
        this.tween.SetTimer(1.1, () => this.HighlightPayoff(choice, theirChoice));

        const completed = await Promise.all([
            this.player.PlayMove(PayoffMatrix.GetOutcome(choice, theirChoice)),
            this.opponent.PlayMove(PayoffMatrix.GetOutcome(theirChoice, choice)),
        ]);

        this.playingRound = false;
        if (!completed.every(Boolean))
            return;
        this.DehighlightPayoff();

        var [youValue, themValue] = PayoffMatrix.Get(choice, theirChoice);
        this.scorePlayer += youValue;
        this.scoreOpponent += themValue;
        this.scoreTextPlayer.SetText(this.scorePlayer.toString());
        this.scoreTextOpponent.SetText(this.scoreOpponent.toString());
    }

    HighlightPayoff(you: Choice, them: Choice)
    {
        var outcome = PayoffMatrix.GetOutcome(you, them);
        this.payoffHighlight.SetTexture(bare.asset.GetTexture("payoffs_highlight" + Outcome[outcome]));
        this.payoffHighlight.visible = true;

        this.GetPayoffLabel("you", you).fill = Game.LABEL_HIGHLIGHT;
        this.GetPayoffLabel("they", them).fill = Game.LABEL_HIGHLIGHT;
    }

    DehighlightPayoff()
    {
        this.payoffHighlight.visible = false;

        for (var choice = Choice.Cooperate; choice <= Choice.Cheat; choice++)
        {
            this.GetPayoffLabel("you", choice).fill = Game.LABEL_COLOR;
            this.GetPayoffLabel("they", choice).fill = Game.LABEL_COLOR;
        }
    }

    GetPayoffLabel(side: "you" | "they", choice: Choice): TextObject
    {
        var suffixes = ["Coop", "Cheat"]; // INDEXED BY Choice
        return this.payoff.GetChildByName<TextObject>(side + suffixes[choice])!;
    }

    AssignPayoffValues()
    {
        var holder = this.payoff.GetChildByName("valuesHolder")!;
        var suffixes = ["Co", "Ch"]; // INDEXED BY Choice

        for (var you = Choice.Cooperate; you <= Choice.Cheat; you++)
        {
            for (var them = Choice.Cooperate; them <= Choice.Cheat; them++)
            {
                var [youValue, themValue] = PayoffMatrix.Get(you, them);
                var youName = "you" + suffixes[you];
                var themName = "they" + suffixes[them];

                holder.GetChildByName<TextObject>(youName + "_" + themName)!.SetText(this.FormatPayoff(youValue));
                holder.GetChildByName<TextObject>(themName + "_" + youName)!.SetText(this.FormatPayoff(themValue));
            }
        }
    }

    FormatPayoff(value: number): string
    {
        return value > 0 ? "+" + value : value.toString();
    }
}

StartBare(Game);