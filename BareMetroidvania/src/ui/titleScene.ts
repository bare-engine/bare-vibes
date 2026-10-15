import { Color, SaveData, Scene, TextObject, TweenTo, Vec2, Easing } from "bare-engine";

// TITLE OVER THE (PAUSED) GAME. ENTER/Z TO PLAY, N FOR A NEW GAME
export class TitleScene extends Scene
{
    onPlay!: () => void;

    constructor()
    {
        super({ UI: true });
    }

    override OnStart(payload: { onPlay: () => void }): void
    {
        this.onPlay = payload.onPlay;

        var text = (str: string, y: number, size: number, color: string) => {
            var t = new TextObject(this, { text: str, fontSize: size, fill: color, stroke: "#10121c", strokeThickness: 4, align: "center" });
            this.AddGameObject(t).SetPivot(0.5, 0.5).SetPosition(bare.width / 2, y);
            return t;
        };

        var title = text("CASTLE OF THE\nCYCLOPS KING", 52, 32, "#ffd84a");
        TweenTo(title, 1.2, { innerY: 3, yoyo: true, repeat: -1, ease: Easing.Sinusoidal.InOut });

        var hasSave = SaveData.visited.size > 0;
        text(hasSave ? "ENTER - continue      N - new game" : "press ENTER to begin", 112, 16, "#e8ecf8");
        text("arrows move   Z jump   X attack   M map", 140, 16, "#9aa3c0");
        text("abilities found later: SHIFT dash", 156, 16, "#6f7896");
    }

    override OnUpdate(): void
    {
        var k = bare.keyboard;
        if (k.IsKeyPressed("enter") || k.IsKeyPressed("z") || k.IsKeyPressed("space"))
        {
            bare.scene.Remove(this);
            this.onPlay();
        }
        else if (k.IsKeyPressed("n"))
        {
            bare.Restart({ clearSaveData: true });
        }
    }

    override OnPreRender(): void
    {
        bare.drawRect({ position: new Vec2(0, 0), width: bare.width, height: bare.height, color: new Color(10, 12, 20, 170) });
    }
}
