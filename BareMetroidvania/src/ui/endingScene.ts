import { Color, SaveData, Scene, TextObject, Vec2 } from "bare-engine";
import { ITEM_TOTAL, ROOMS } from "../world";

// SHOWN WHEN YOU WALK THROUGH THE DOOR BEHIND THE BOSS
export class EndingScene extends Scene
{
    constructor()
    {
        super({ UI: true });
    }

    override OnStart(): void
    {
        var lines = [
            ["THE CASTLE IS FREE", 40, "#ffd84a"],
            [`Items found      ${SaveData.items.size} / ${ITEM_TOTAL}`, 80, "#e8ecf8"],
            [`Rooms explored   ${SaveData.visited.size} / ${ROOMS.length}`, 96, "#e8ecf8"],
            [`Deaths           ${SaveData.deaths}`, 112, "#e8ecf8"],
            [`Time             ${Math.floor(SaveData.playTime / 60)}m ${Math.floor(SaveData.playTime % 60)}s`, 128, "#e8ecf8"],
            ["N - new game", 156, "#9aa3c0"],
        ] as const;

        for (var [str, y, color] of lines)
        {
            var t = new TextObject(this, { text: str, fontSize: y == 40 ? 24 : 16, fill: color, stroke: "#10121c", strokeThickness: 3 });
            this.AddGameObject(t).SetPivot(0.5, 0.5).SetPosition(bare.width / 2, y);
        }
    }

    override OnUpdate(): void
    {
        if (bare.keyboard.IsKeyPressed("n"))
            bare.Restart({ clearSaveData: true });
    }

    override OnPreRender(): void
    {
        bare.drawRect({ position: new Vec2(0, 0), width: bare.width, height: bare.height, color: new Color(10, 12, 20, 230) });
    }
}
