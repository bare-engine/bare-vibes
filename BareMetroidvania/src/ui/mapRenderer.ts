import { Color, SaveData, Vec2 } from "bare-engine";
import { AREAS, CELL_H, CELL_W, LINKS, ROOMS, RoomInfo } from "../world";

export interface MapView
{
    // SCREEN AREA TO DRAW IN
    x: number;
    y: number;
    width: number;
    height: number;
    // SIZE OF ONE CELL ON SCREEN
    cellW: number;
    cellH: number;
    // CELL COORDINATE AT THE CENTER OF THE AREA
    centerX: number;
    centerY: number;
}

const colorCache = new Map<string, Color>();
function C(hex: string, alpha: number = 255): Color
{
    var key = hex + alpha;
    var c = colorCache.get(key);
    if (!c)
    {
        c = Color.fromHex(hex);
        c.a = alpha;
        colorCache.set(key, c);
    }
    return c;
}

// DRAWS VISITED ROOMS, OUTLINES OF ROOMS YOU KNOW A DOOR TO, DOORS, SHRINES, ITEMS YOU HAVEN'T TAKEN
// AND THE PLAYER. RECTANGLES ARE CLIPPED TO THE VIEW SO IT ALSO WORKS AS A MINIMAP
export class MapRenderer
{
    static Draw(view: MapView, currentRoom: RoomInfo | undefined, playerWorld: Vec2 | null, blink: boolean)
    {
        var visited = SaveData.visited;

        var toScreenX = (cx: number) => view.x + view.width / 2 + (cx - view.centerX) * view.cellW;
        var toScreenY = (cy: number) => view.y + view.height / 2 + (cy - view.centerY) * view.cellH;

        var rect = (x: number, y: number, w: number, h: number, color: Color) => {
            // CLIP TO THE VIEW
            var x1 = Math.max(x, view.x), y1 = Math.max(y, view.y);
            var x2 = Math.min(x + w, view.x + view.width), y2 = Math.min(y + h, view.y + view.height);
            if (x2 <= x1 || y2 <= y1)
                return;
            bare.drawRect({ position: new Vec2(Math.round(x1), Math.round(y1)), width: Math.round(x2 - x1), height: Math.round(y2 - y1), color });
        };

        // ROOMS NEXT TO VISITED ONES ARE SHOWN AS OUTLINES
        var known = new Set<string>();
        for (var link of LINKS)
        {
            if (visited.has(link.a)) known.add(link.b);
            if (visited.has(link.b)) known.add(link.a);
        }

        for (var room of ROOMS)
        {
            var isVisited = visited.has(room.id);
            if (!isVisited && !known.has(room.id))
                continue;

            var x = toScreenX(room.x), y = toScreenY(room.y);
            var w = room.w * view.cellW, h = room.h * view.cellH;
            var areaColor = AREAS[room.area].color;

            if (isVisited)
            {
                rect(x, y, w, h, C("#e8ecf8"));
                rect(x + 1, y + 1, w - 2, h - 2, C(areaColor, room == currentRoom && blink ? 255 : 200));
            }
            else
            {
                rect(x, y, w, h, C(areaColor, 90));
                rect(x + 1, y + 1, w - 2, h - 2, C("#000000", 160));
            }
        }

        // DOORS: A SMALL BRIDGE ACROSS THE EDGE BETWEEN TWO ROOMS
        var dw = Math.max(2, Math.round(view.cellW / 4)), dh = Math.max(2, Math.round(view.cellH / 3));
        for (var link of LINKS)
        {
            if (!visited.has(link.a) && !visited.has(link.b))
                continue;

            var cx = toScreenX(link.x), cy = toScreenY(link.y);
            var doorColor = C("#e8ecf8");
            if (link.dir == "right") rect(cx + view.cellW - 1, cy + view.cellH - dh - 1, 2, dh, doorColor);
            if (link.dir == "left") rect(cx - 1, cy + view.cellH - dh - 1, 2, dh, doorColor);
            if (link.dir == "down") rect(cx + view.cellW / 2 - dw / 2, cy + view.cellH - 1, dw, 2, doorColor);
            if (link.dir == "up") rect(cx + view.cellW / 2 - dw / 2, cy - 1, dw, 2, doorColor);
        }

        // SHRINES, ITEMS, BOSS
        var dot = Math.max(2, Math.round(view.cellH / 4));
        for (var room of ROOMS)
        {
            if (!visited.has(room.id))
                continue;
            var mx = toScreenX(room.x) + view.cellW / 2 - dot / 2;
            var my = toScreenY(room.y) + view.cellH / 2 - dot / 2;
            if (room.shrine)
                rect(mx - dot, my, dot, dot, C("#7dffb0"));
            if (room.item && !SaveData.items.has(room.item.id))
                rect(mx + (room.shrine ? dot : 0), my, dot, dot, C("#ffd84a"));
            if (room.boss && !SaveData.bossDefeated)
                rect(toScreenX(room.x + room.w / 2) - dot / 2, my, dot, dot, C("#ff4a5a"));
        }

        // PLAYER
        if (playerWorld && blink)
        {
            var px = toScreenX(playerWorld.x / CELL_W), py = toScreenY(playerWorld.y / CELL_H);
            rect(px - 1, py - 2, 3, 3, C("#ffffff"));
        }
    }
}
