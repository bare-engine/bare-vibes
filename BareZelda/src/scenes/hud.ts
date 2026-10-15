import { Color, GameObject, SaveData, Scene, TextObject, TweenTo } from 'bare-engine';
import { DUNGEONS, ITEMS, ItemCount } from '../game/items';
import { QUESTS } from '../game/quests';
import { Sfx } from '../game/sfx';
import { State, USABLE_ITEMS } from '../game/state';
import { World } from './world';

export const FONT = 'Verdana, Geneva, sans-serif';

const COLORS = {
    panel: Color.fromHex('#1a1c2ce8'),
    panelSolid: Color.fromHex('#1a1c2c'),
    border: Color.fromHex('#f4f4f4'),
    bar: Color.fromHex('#1a1c2cc0'),
    gold: '#ffcd75',
    white: '#f4f4f4',
    gray: '#94b0c2',
    select: Color.fromHex('#ffcd75'),
    slot: Color.fromHex('#333c57'),
    bossRed: Color.fromHex('#b13e53'),
};

// WORD WRAP FOR THE FIXED WIDTH TEXT BOXES
export function Wrap(text: string, width: number): string
{
    const lines: string[] = [];
    for (const paragraph of text.split('\n'))
    {
        let line = '';
        for (const word of paragraph.split(' '))
        {
            if (line && (line + ' ' + word).length > width)
            {
                lines.push(line);
                line = word;
            }
            else
                line = line ? line + ' ' + word : word;
        }
        lines.push(line);
    }
    return lines.join('\n');
}

type DialogueState = {
    speaker: string;
    full: string;
    shown: number;
    options: string[] | null;
    choice: number;
    resolve: (choice: number) => void;
};

// THE USER INTERFACE ON TOP OF THE WORLD: HEARTS, ITEMS, DIALOGUE, THE BAG, FADES
export class HUD extends Scene
{
    static instance: HUD;

    fadeAlpha = 0;

    private hearts: GameObject[] = [];
    private rupeeText!: TextObject;
    private keyIcon!: GameObject;
    private keyText!: TextObject;
    private itemIcon!: GameObject;
    private itemCount!: TextObject;
    private itemLabel!: TextObject;

    private dialogue: DialogueState | null = null;
    private dialogueSpeaker!: TextObject;
    private dialogueText!: TextObject;
    private dialogueIcon!: GameObject;
    private optionTexts: TextObject[] = [];

    private banner!: TextObject;
    private toast!: TextObject;
    private toastTime = 0;

    private menu: GameObject | null = null;
    private menuIndex = 0;
    private menuIcons: GameObject[] = [];

    private gameOver: GameObject | null = null;

    bossName = '';
    bossHp = 0;
    bossMaxHp = 0;

    private pauseCount = 0;

    constructor()
    {
        super({ UI: true });
    }

    override OnAwake()
    {
        HUD.instance = this;
    }

    override OnStart()
    {
        for (let i = 0; i < 10; i++)
            this.hearts.push(this.AddGameObject('/heart').SetPosition(5 + (i % 10) * 9, 4));

        this.AddGameObject('/rupee').SetPosition(102, 3);
        this.rupeeText = this.Text(112, 3, '000', 8);
        this.keyIcon = this.AddGameObject('/key').SetPosition(146, 3);
        this.keyText = this.Text(156, 3, 'x0', 8);

        this.itemIcon = this.AddGameObject('/bow').CenterPivot().SetPosition(300, 11);
        this.itemCount = this.Text(286, 13, '', 7).SetPivot(1, 0) as TextObject;
        this.itemLabel = this.Text(260, 3, 'K', 7, COLORS.gray);

        this.dialogueSpeaker = this.Text(18, 121, '', 8, COLORS.gold);
        this.dialogueText = this.Text(18, 133, '', 8);
        this.dialogueText.textTexture.style = { lineHeight: 1.3 };
        this.dialogueIcon = this.AddGameObject('/sword').CenterPivot().SetPosition(296, 146);

        this.banner = this.Text(160, 34, '', 14, COLORS.white);
        this.banner.SetPivot(0.5, 0.5);
        this.banner.alpha = 0;
        this.toast = this.Text(160, 24, '', 8, COLORS.white);
        this.toast.SetPivot(0.5, 0);
        this.toast.alpha = 0;

        this.RefreshDialogue();
    }

    Text(x: number, y: number, text: string, size: number, fill: string = COLORS.white): TextObject
    {
        const t = new TextObject(this, { text, fontSize: size, fontFamily: FONT, fontWeight: 'bold', fill, stroke: '#1a1c2c', strokeThickness: 2 });
        this.AddGameObject(t).SetPosition(x, y);
        return t;
    }

    // ---- PAUSING THE WORLD WHILE THE PLAYER READS OR PICKS ----

    PauseWorld(paused: boolean)
    {
        this.pauseCount += paused ? 1 : -1;
        if (World.instance)
            World.instance.paused = this.pauseCount > 0;
    }

    get busy(): boolean
    {
        return !!this.dialogue || !!this.menu || !!this.gameOver;
    }

    // ---- FADES AND MESSAGES ----

    SetFade(alpha: number)
    {
        bare.tween.RemoveAllFrom(this);
        this.fadeAlpha = alpha;
    }

    async Fade(alpha: number, seconds: number)
    {
        await TweenTo(this, seconds, { fadeAlpha: alpha, ease: (k: number) => k }).promise;
    }

    ShowBanner(text: string)
    {
        if (!text)
            return;
        this.banner.SetText(text);
        this.banner.alpha = 0;
        TweenTo(this.banner, 0.4, { alpha: 1 });
        TweenTo(this.banner, 0.6, { alpha: 0, delay: 2 }, false);
    }

    Toast(text: string)
    {
        this.toast.SetText(text);
        this.toast.alpha = 1;
        this.toastTime = 2.2;
    }

    // ---- DIALOGUE ----

    // SHOWS A TEXT BOX AND WAITS UNTIL THE PLAYER CLOSES IT
    async Say(speaker: string, text: string, icon = ''): Promise<void>
    {
        await this.Open(speaker, text, null, icon);
    }

    // SHOWS A TEXT BOX WITH OPTIONS, RESOLVES WITH THE INDEX PICKED. ESCAPE PICKS THE LAST ONE
    async Choose(speaker: string, text: string, options: string[]): Promise<number>
    {
        return this.Open(speaker, text, options, '');
    }

    private Open(speaker: string, text: string, options: string[] | null, icon: string): Promise<number>
    {
        this.PauseWorld(true);
        return new Promise<number>(resolve => {
            this.dialogue = { speaker, full: Wrap(text, icon ? 46 : 52), shown: 0, options, choice: 0, resolve };
            this.dialogueIcon.visible = !!icon;
            if (icon)
                this.dialogueIcon.InitTexture(icon);
            this.RefreshDialogue();
        });
    }

    private CloseDialogue()
    {
        const d = this.dialogue!;
        this.dialogue = null;
        this.RefreshDialogue();
        this.PauseWorld(false);
        World.instance?.pc.BlockInput(0.2);
        d.resolve(d.choice);
    }

    private RefreshDialogue()
    {
        const d = this.dialogue;
        this.dialogueSpeaker.visible = !!d;
        this.dialogueText.visible = !!d;
        if (!d)
            this.dialogueIcon.visible = false;

        for (const t of this.optionTexts)
            t.Remove();
        this.optionTexts = [];

        if (!d)
            return;

        this.dialogueSpeaker.SetText(d.speaker);
        this.dialogueText.SetText(d.full.slice(0, Math.floor(d.shown)));

        if (d.options && d.shown >= d.full.length)
        {
            d.options.forEach((option, i) => {
                const selected = i == d.choice;
                this.optionTexts.push(this.Text(24 + i * 74, 160, (selected ? '> ' : '  ') + option, 8, selected ? COLORS.gold : COLORS.gray));
            });
        }
    }

    private UpdateDialogue(deltaTime: number)
    {
        const d = this.dialogue!;
        const confirm = bare.keyboard.IsKeyPressed('space') || bare.keyboard.IsKeyPressed('enter') || bare.keyboard.IsCodePressed('KeyJ') || bare.keyboard.IsCodePressed('KeyK');

        if (d.shown < d.full.length)
        {
            const before = Math.floor(d.shown);
            d.shown = confirm ? d.full.length : Math.min(d.full.length, d.shown + deltaTime * 55);
            if (Math.floor(d.shown) != before)
            {
                if (Math.floor(d.shown) % 3 == 0)
                    Sfx('text', 0.15);
                this.RefreshDialogue();
            }
            return;
        }

        if (d.options)
        {
            const prev = d.choice;
            if (bare.keyboard.IsLeftPressed() || bare.keyboard.IsUpPressed())
                d.choice = (d.choice + d.options.length - 1) % d.options.length;
            if (bare.keyboard.IsRightPressed() || bare.keyboard.IsDownPressed())
                d.choice = (d.choice + 1) % d.options.length;
            if (bare.keyboard.IsKeyPressed('escape'))
            {
                d.choice = d.options.length - 1;
                Sfx('menu', 0.3);
                this.CloseDialogue();
                return;
            }
            if (prev != d.choice)
            {
                Sfx('menu', 0.3);
                this.RefreshDialogue();
            }
        }

        if (confirm)
        {
            Sfx(d.options ? 'select' : 'menu', 0.3);
            this.CloseDialogue();
        }
    }

    // ---- THE BAG: ITEMS, QUESTS, SIGILS ----

    OpenMenu()
    {
        if (this.menu)
            return;
        Sfx('menu', 0.4);
        this.PauseWorld(true);
        this.menu = this.AddGameObject();
        const owned = USABLE_ITEMS.filter(i => State.Has(i));
        this.menuIndex = Math.max(0, owned.indexOf(SaveData.equipped));
        this.BuildMenu();
    }

    private CloseMenu()
    {
        this.menu?.Remove();
        this.menu = null;
        this.menuIcons = [];
        this.PauseWorld(false);
        World.instance?.pc.BlockInput(0.2);
        Sfx('menu', 0.4);
    }

    private BuildMenu()
    {
        const menu = this.menu!;
        for (const child of [...menu.children])
            child.Remove();
        this.menuIcons = [];

        const add = (obj: GameObject) => { menu.AddChild(obj); return obj; };
        const text = (x: number, y: number, s: string, size: number, fill: string = COLORS.white) => {
            const t = new TextObject(this, { text: s, fontSize: size, fontFamily: FONT, fontWeight: 'bold', fill, stroke: '#1a1c2c', strokeThickness: 2 });
            add(t).SetPosition(x, y);
            t.textTexture.style = { lineHeight: 1.25 };
            return t;
        };

        text(20, 24, 'ITEMS', 9, COLORS.gold);
        const owned = USABLE_ITEMS.filter(i => State.Has(i));
        USABLE_ITEMS.forEach((item, i) => {
            const x = 32 + (i % 2) * 34, y = 52 + Math.floor(i / 2) * 32;
            if (!State.Has(item))
                return;
            const icon = add(this.AddGameObject('/' + ITEMS[item].sprite)).CenterPivot().SetPosition(x, y);
            this.menuIcons.push(icon);
            const count = ItemCount(item);
            if (count !== null)
                text(x + 4, y + 2, String(count), 7);
        });
        if (owned.length == 0)
            text(20, 112, 'Nothing yet', 7, COLORS.gray);
        else
            text(20, 112, ITEMS[owned[this.menuIndex]]?.name ?? '', 7, COLORS.white);

        text(20, 124, 'GEAR', 8, COLORS.gold);
        ['sword', 'flippers', 'ring'].filter(i => State.Has(i)).forEach((item, i) => {
            add(this.AddGameObject('/' + ITEMS[item].sprite)).CenterPivot().SetPosition(28 + i * 20, 143);
        });

        text(20, 150, 'SIGILS', 7, COLORS.gold);
        Object.entries(DUNGEONS).forEach(([id, info], i) => {
            const s = add(this.AddGameObject('/sigil')).CenterPivot().SetPosition(26 + i * 14, 167).SetScale(0.7);
            if (SaveData.sigils.has(id))
                s.SetColor(info.color);
            else
                s.SetColor('#333c57');
        });

        text(124, 24, 'QUESTS', 9, COLORS.gold);
        let y = 40;
        for (const [id, quest] of Object.entries(QUESTS))
        {
            const status = State.Quest(id);
            if (!status)
                continue;
            text(124, y, (status == 'done' ? '* ' : '') + quest.title, 7, status == 'done' ? COLORS.gray : COLORS.gold);
            const desc = Wrap(quest.describe(), 44);
            text(130, y + 10, desc, 6, status == 'done' ? COLORS.gray : COLORS.white);
            y += 14 + desc.split('\n').length * 8;
        }
        if (y == 40)
            text(124, 40, 'No quests yet. Talk to the villagers.', 7, COLORS.gray);

        const minutes = Math.floor(SaveData.playTime / 60);
        text(124, 164, `Time ${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}   Q/E switch item   ENTER close`, 6, COLORS.gray);
    }

    private UpdateMenu()
    {
        const owned = USABLE_ITEMS.filter(i => State.Has(i));
        if (owned.length > 0)
        {
            let index = this.menuIndex;
            if (bare.keyboard.IsLeftPressed() || bare.keyboard.IsUpPressed()) index--;
            if (bare.keyboard.IsRightPressed() || bare.keyboard.IsDownPressed()) index++;
            index = (index + owned.length) % owned.length;
            if (index != this.menuIndex)
            {
                this.menuIndex = index;
                SaveData.equipped = owned[index];
                Sfx('menu', 0.3);
                this.BuildMenu();
            }
        }

        if (bare.keyboard.IsKeyPressed('enter') || bare.keyboard.IsKeyPressed('escape') || bare.keyboard.IsCodePressed('KeyI'))
            this.CloseMenu();
    }

    // ---- GAME OVER ----

    ShowGameOver()
    {
        if (this.gameOver)
            return;
        this.PauseWorld(true);
        this.gameOver = this.AddGameObject();
        const t1 = new TextObject(this, { text: 'GAME OVER', fontSize: 20, fontFamily: FONT, fontWeight: 'bold', fill: '#b13e53', stroke: '#1a1c2c', strokeThickness: 3 });
        const t2 = new TextObject(this, { text: 'Press ENTER to try again', fontSize: 8, fontFamily: FONT, fontWeight: 'bold', fill: COLORS.white, stroke: '#1a1c2c', strokeThickness: 2 });
        this.gameOver.AddChild(t1).SetPosition(160, 80).SetPivot(0.5, 0.5);
        this.gameOver.AddChild(t2).SetPosition(160, 104).SetPivot(0.5, 0.5);
    }

    private UpdateGameOver()
    {
        if (bare.keyboard.IsKeyPressed('enter') || bare.keyboard.IsKeyPressed('space'))
        {
            this.gameOver?.Remove();
            this.gameOver = null;
            this.PauseWorld(false);
            Sfx('select', 0.4);
            World.instance.Respawn();
        }
    }

    // ---- EVERY FRAME ----

    override OnUpdate(deltaTime: number)
    {
        if (this.gameOver)
            this.UpdateGameOver();
        else if (this.dialogue)
            this.UpdateDialogue(deltaTime);
        else if (this.menu)
            this.UpdateMenu();
        else if (World.instance && !World.instance.warping && World.instance.pc?.CanAct())
        {
            if (bare.keyboard.IsKeyPressed('enter') || bare.keyboard.IsKeyPressed('escape') || bare.keyboard.IsCodePressed('KeyI'))
                this.OpenMenu();
        }

        if (this.toastTime > 0)
        {
            this.toastTime -= deltaTime;
            this.toast.alpha = Math.min(1, this.toastTime * 2);
        }

        this.UpdateBar();
    }

    private UpdateBar()
    {
        // HEARTS: TWO HALVES EACH
        const hearts = SaveData.maxHp / 2;
        this.hearts.forEach((heart, i) => {
            heart.visible = i < hearts;
            const hp = SaveData.hp - i * 2;
            heart.InitTexture(hp >= 2 ? 'heart' : hp == 1 ? 'heart_half' : 'heart_empty');
        });

        this.rupeeText.SetText(String(SaveData.rupees).padStart(3, '0'));

        const world = World.instance;
        const inDungeon = !!world?.isDungeon;
        this.keyIcon.visible = inDungeon;
        this.keyText.visible = inDungeon;
        if (inDungeon)
            this.keyText.SetText(`x${State.Keys(world.levelName)}${State.HasBossKey(world.levelName) ? ' +BIG' : ''}`);

        const item = SaveData.equipped;
        this.itemIcon.visible = !!item;
        this.itemLabel.visible = !!item;
        if (item)
        {
            this.itemIcon.InitTexture(ITEMS[item].sprite);
            const count = ItemCount(item);
            this.itemCount.SetText(count === null ? '' : String(count));
        }
        else
            this.itemCount.SetText('');
    }

    override OnPreRender()
    {
        // TOP BAR
        bare.drawRect({ x: 0, y: 0, width: bare.width, height: 20, color: COLORS.bar });
        if (SaveData.equipped)
        {
            bare.drawRect({ x: 288, y: 1, width: 24, height: 19, color: COLORS.border });
            bare.drawRect({ x: 289, y: 2, width: 22, height: 17, color: COLORS.panelSolid });
        }

        if (this.dialogue)
            this.Panel(10, 116, 300, 60);

        if (this.menu)
        {
            this.Panel(10, 18, 300, 156);
            const owned = USABLE_ITEMS.filter(i => State.Has(i));
            USABLE_ITEMS.forEach((item, i) => {
                const x = 32 + (i % 2) * 34, y = 52 + Math.floor(i / 2) * 32;
                const selected = owned[this.menuIndex] == item;
                if (selected)
                    bare.drawRect({ x: x - 14, y: y - 14, width: 28, height: 28, color: COLORS.select });
                bare.drawRect({ x: x - 12, y: y - 12, width: 24, height: 24, color: COLORS.slot });
            });
        }

        if (this.gameOver)
            bare.drawRect({ x: 0, y: 0, width: bare.width, height: bare.height, color: Color.fromHex('#1a1c2cd0') });
    }

    override OnPostRender()
    {
        // BOSS HEALTH
        if (this.bossMaxHp > 0 && this.bossHp > 0 && !this.dialogue)
        {
            const w = 160, x = (bare.width - w) / 2, y = 166;
            bare.drawRect({ x: x - 1, y: y - 1, width: w + 2, height: 7, color: COLORS.panelSolid });
            bare.drawRect({ x, y, width: w * this.bossHp / this.bossMaxHp, height: 5, color: COLORS.bossRed });
        }

        if (this.fadeAlpha > 0)
            bare.drawRect({ x: 0, y: 0, width: bare.width, height: bare.height, color: new Color(14, 14, 22, Math.round(this.fadeAlpha * 255)) });
    }

    private Panel(x: number, y: number, w: number, h: number)
    {
        bare.drawRect({ x: x - 1, y: y - 1, width: w + 2, height: h + 2, color: COLORS.border });
        bare.drawRect({ x, y, width: w, height: h, color: COLORS.panelSolid });
    }
}
