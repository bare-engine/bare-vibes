import { Color, SaveData, Scene, TextObject, Vec2 } from "bare-engine";
import { AREAS, CELL_H, CELL_W, ITEM_TOTAL, ROOMS, RoomInfo } from "../world";
import { MapRenderer } from "./mapRenderer";

export interface MapPayload
{
    room: RoomInfo;
    playerWorld: Vec2;
    onClose: () => void;
    onWarp: () => void;
}

// THE FULL MAP. THE GAME IS PAUSED WHILE IT'S OPEN. HOLD ENTER TO WARP BACK TO THE LAST SHRINE
export class MapScene extends Scene
{
    payload!: MapPayload;
    warpHold = 0;
    warpText!: TextObject;

    constructor()
    {
        super({ UI: true });
    }

    override OnStart(payload: MapPayload): void
    {
        this.payload = payload;

        var text = (str: string, x: number, y: number, color: string, pivotX: number) => {
            var t = new TextObject(this, { text: str, fontSize: 16, fill: color, stroke: "#10121c", strokeThickness: 3 });
            this.AddGameObject(t).SetPivot(pivotX, 0).SetPosition(x, y);
            return t;
        };

        var room = payload.room;
        text(`${AREAS[room.area].name} - ${room.name}`, bare.width / 2, 4, "#e8ecf8", 0.5);
        var minutes = Math.floor(SaveData.playTime / 60);
        text(`Items ${SaveData.items.size}/${ITEM_TOTAL}   Rooms ${SaveData.visited.size}/${ROOMS.length}   ${minutes}m`, bare.width / 2, bare.height - 34, "#ffd84a", 0.5);
        this.warpText = text("M: close    hold ENTER: warp to shrine", bare.width / 2, bare.height - 18, "#9aa3c0", 0.5);
    }

    override OnUpdate(deltaTime: number): void
    {
        var k = bare.keyboard;
        if (k.IsKeyPressed("m") || k.IsKeyPressed("tab") || k.IsKeyPressed("escape"))
        {
            this.payload.onClose();
            return;
        }

        if (k.IsKeyDown("enter"))
        {
            this.warpHold += deltaTime;
            if (this.warpHold > 1)
            {
                this.payload.onWarp();
                return;
            }
        }
        else
        {
            this.warpHold = 0;
        }
    }

    override OnPreRender(): void
    {
        bare.drawRect({ position: new Vec2(0, 0), width: bare.width, height: bare.height, color: new Color(10, 12, 20, 235) });
    }

    override OnRender(): void
    {

        // THE WHOLE WORLD IS 15 x 11 CELLS
        var view = { x: 10, y: 22, width: bare.width - 20, height: bare.height - 60, cellW: 18, cellH: 11, centerX: 7.5, centerY: 5.5 };
        MapRenderer.Draw(view, this.payload.room, this.payload.playerWorld, Math.floor(bare.time / 250) % 2 == 0);

        if (this.warpHold > 0)
            bare.drawRect({ position: new Vec2(bare.width / 2 - 50, bare.height - 4), width: 100 * Math.min(1, this.warpHold), height: 2, color: new Color(125, 255, 176, 255) });
    }
}
