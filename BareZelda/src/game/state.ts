import { SaveData } from 'bare-engine';

// EVERYTHING THAT SURVIVES BETWEEN SESSIONS. HEALTH IS COUNTED IN HALF HEARTS
declare module 'bare-engine'
{
    namespace SaveData
    {
        let hasSave: boolean;
        let hp: number;
        let maxHp: number;
        let rupees: number;
        let arrows: number;
        let bombs: number;
        let potions: number;
        let items: Set<string>;
        let equipped: string;
        let flags: Set<string>;
        let keys: Record<string, number>;
        let quests: Record<string, QuestStatus>;
        let slimesAtQuestStart: number;
        let slimesDefeated: number;
        let sigils: Set<string>;
        let level: string;
        let spawn: string;
        let playTime: number;
    }
}

export type QuestStatus = 'active' | 'done';

export const MAX_ARROWS = 30;
export const MAX_BOMBS = 15;
export const MAX_POTIONS = 3;
export const MAX_RUPEES = 999;

export function SetSaveDefaults()
{
    bare.storage.SetDefaults({
        hasSave: false,
        hp: 6,
        maxHp: 6,
        rupees: 0,
        arrows: 0,
        bombs: 0,
        potions: 0,
        items: new Set<string>(),
        equipped: '',
        flags: new Set<string>(),
        keys: {},
        quests: {},
        slimesAtQuestStart: 0,
        slimesDefeated: 0,
        sigils: new Set<string>(),
        level: '',
        spawn: '',
        playTime: 0,
    });
}

// ITEMS YOU CAN PUT ON THE ITEM BUTTON
export const USABLE_ITEMS = ['bow', 'bombs', 'fireRod', 'potion'];

export const State = {
    Has(item: string): boolean
    {
        return SaveData.items.has(item);
    },

    Flag(name: string): boolean
    {
        return SaveData.flags.has(name);
    },

    SetFlag(name: string)
    {
        SaveData.flags.add(name);
    },

    Keys(level: string): number
    {
        return SaveData.keys[level] ?? 0;
    },

    AddKeys(level: string, amount: number)
    {
        SaveData.keys[level] = Math.max(0, State.Keys(level) + amount);
    },

    HasBossKey(level: string): boolean
    {
        return State.Flag(`bossKey:${level}`);
    },

    Heal(halfHearts: number)
    {
        SaveData.hp = Math.min(SaveData.maxHp, SaveData.hp + halfHearts);
    },

    AddRupees(amount: number)
    {
        SaveData.rupees = Math.max(0, Math.min(MAX_RUPEES, SaveData.rupees + amount));
    },

    // GIVES AN ITEM FROM A CHEST, A PICKUP OR A PERSON. level IS WHERE IT WAS FOUND, FOR KEYS
    Give(item: string, amount: number, level: string)
    {
        switch (item)
        {
            case 'sword':
            case 'flippers':
            case 'ring':
                SaveData.items.add(item);
                break;
            case 'bow':
                SaveData.items.add(item);
                SaveData.arrows = Math.min(MAX_ARROWS, SaveData.arrows + 20);
                break;
            case 'bombs':
                SaveData.items.add(item);
                SaveData.bombs = Math.min(MAX_BOMBS, SaveData.bombs + (amount > 1 ? amount : 10));
                break;
            case 'fireRod':
                SaveData.items.add(item);
                break;
            case 'potion':
                SaveData.items.add(item);
                SaveData.potions = Math.min(MAX_POTIONS, SaveData.potions + amount);
                break;
            case 'arrows':
                SaveData.arrows = Math.min(MAX_ARROWS, SaveData.arrows + amount);
                break;
            case 'bombRefill':
                SaveData.bombs = Math.min(MAX_BOMBS, SaveData.bombs + amount);
                break;
            case 'key':
                State.AddKeys(level, amount);
                break;
            case 'bossKey':
                State.SetFlag(`bossKey:${level}`);
                break;
            case 'heartContainer':
                SaveData.maxHp = Math.min(20, SaveData.maxHp + 2);
                SaveData.hp = SaveData.maxHp;
                break;
            case 'heart':
                State.Heal(2 * amount);
                break;
            case 'rupees':
                State.AddRupees(amount);
                break;
        }

        // PUT THE FIRST USABLE ITEM ON THE ITEM BUTTON
        if (!SaveData.equipped && USABLE_ITEMS.includes(item))
            SaveData.equipped = item;
    },

    CycleEquipped(direction: number = 1)
    {
        const owned = USABLE_ITEMS.filter(i => State.Has(i));
        if (owned.length == 0)
            return;
        const index = owned.indexOf(SaveData.equipped);
        SaveData.equipped = owned[(index + direction + owned.length) % owned.length];
    },

    Quest(id: string): QuestStatus | undefined
    {
        return SaveData.quests[id];
    },

    SetQuest(id: string, status: QuestStatus)
    {
        SaveData.quests[id] = status;
    },

    Save()
    {
        SaveData.hasSave = true;
        bare.storage.Save();
    },
};
