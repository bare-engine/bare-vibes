import { SaveData } from 'bare-engine';
import { State } from './state';

export interface ItemInfo
{
    name: string;
    sprite: string;
    // SHOWN WHEN YOU GET IT
    text: string;
}

export const ITEMS: Record<string, ItemInfo> = {
    sword: { name: 'Sword', sprite: 'sword', text: 'You got a Sword! Press SPACE to swing it.' },
    bow: { name: 'Bow', sprite: 'bow', text: 'You got the Bow! Pick it with Q, then shoot with K. It came with 20 arrows.' },
    bombs: { name: 'Bombs', sprite: 'bomb', text: 'You got Bombs! Place one with K. They crack weak walls and rocks.' },
    flippers: { name: 'Flippers', sprite: 'flippers', text: 'You got the Flippers! Now you can swim in deep water.' },
    fireRod: { name: 'Fire Rod', sprite: 'fire_rod', text: 'You got the Fire Rod! Its flames light torches and burn thorns.' },
    potion: { name: 'Red Potion', sprite: 'potion', text: 'You got a Red Potion! Drink it with K to refill your hearts.' },
    ring: { name: "Tom's Ring", sprite: 'ring', text: "You found a silver ring. Old Tom the fisher must be missing it." },
    key: { name: 'Small Key', sprite: 'key', text: 'You got a Small Key! It opens one locked door in this dungeon.' },
    bossKey: { name: 'Big Key', sprite: 'boss_key', text: 'You got the Big Key! It opens the door to the master of this dungeon.' },
    heartContainer: { name: 'Heart Container', sprite: 'heart_container', text: 'You got a Heart Container! Your life grows by one heart.' },
    rupees: { name: 'Rupees', sprite: 'rupee_red', text: '' },
    arrows: { name: 'Arrows', sprite: 'arrow', text: '' },
    bombRefill: { name: 'Bombs', sprite: 'bomb', text: '' },
};

export function ItemText(item: string, amount: number): string
{
    if (item == 'rupees')
        return `You got ${amount} rupees!`;
    if (item == 'arrows')
        return `You got ${amount} arrows!`;
    if (item == 'bombRefill')
        return `You got ${amount} bombs!`;
    return ITEMS[item]?.text ?? `You got ${item}!`;
}

// THE COUNT SHOWN NEXT TO AN ITEM IN THE HUD AND MENU
export function ItemCount(item: string): number | null
{
    switch (item)
    {
        case 'bow': return SaveData.arrows;
        case 'bombs': return SaveData.bombs;
        case 'potion': return SaveData.potions;
    }
    return null;
}

export const DUNGEONS: Record<string, { title: string; sigilName: string; color: string }> = {
    d1: { title: 'Forest Temple', sigilName: 'Forest Sigil', color: '#7cf08a' },
    d2: { title: 'Stone Cavern', sigilName: 'Stone Sigil', color: '#e0b070' },
    d3: { title: 'Lake Shrine', sigilName: 'Water Sigil', color: '#70c8ff' },
    d4: { title: 'Ember Fortress', sigilName: 'Fire Sigil', color: '#ff7050' },
    d5: { title: 'Dark Castle', sigilName: 'Shadow Sigil', color: '#c080ff' },
};

export function SigilCount(): number
{
    return SaveData.sigils.size;
}

export function HasAll(...items: string[]): boolean
{
    return items.every(i => State.Has(i));
}
