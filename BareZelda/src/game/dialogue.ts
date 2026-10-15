import { SaveData } from 'bare-engine';
import type { NpcComponent } from '../components/npcComponent';
import { HUD } from '../scenes/hud';
import { World } from '../scenes/world';
import { Burst } from './fx';
import { Center } from './hit';
import { ItemText } from './items';
import { QUESTS, SLIME_GOAL, SlimesForQuest } from './quests';
import { Sfx } from './sfx';
import { MAX_ARROWS, MAX_BOMBS, MAX_POTIONS, State } from './state';

const say = (who: string, text: string) => HUD.instance.Say(who, text);
const choose = (who: string, text: string, options: string[]) => HUD.instance.Choose(who, text, options);

async function give(item: string, amount = 1)
{
    const world = World.instance;
    State.Give(item, amount, world.levelName);
    State.Save();
    await world.pc.HoldUp(item, ItemText(item, amount));
}

async function startQuest(id: string)
{
    if (State.Quest(id))
        return;
    State.SetQuest(id, 'active');
    State.Save();
    Sfx('secret', 0.4);
    HUD.instance.Toast(`New quest: ${QUESTS[id].title}`);
}

function finishQuest(id: string)
{
    State.SetQuest(id, 'done');
    State.Save();
    HUD.instance.Toast(`Quest complete: ${QUESTS[id].title}`);
}

// WHAT THE ELDER SAYS NEXT, BY HOW FAR YOU ARE
function elderHint(): string
{
    const s = SaveData.sigils;
    if (!s.has('d1')) return 'The Forest Temple lies west, through the woods. Follow the path from the village square.';
    if (!s.has('d2')) return 'The bow! East of the village a stone eye keeps the gate shut. Shoot it, and seek the Stone Cavern beyond.';
    if (!s.has('d3')) return 'Bombs can shatter the cracked rocks on the east shore of the lake. The Lake Shrine waits on the north shore.';
    if (!s.has('d4')) return 'With flippers you can swim the river east of the lake. The Ember Fortress stands in the ashen lands.';
    return 'Burn the thorns north of the forest with your fire rod. With four sigils, the seal of the Dark Castle will break. Go, and end this!';
}

const SCRIPTS: Record<string, (npc: NpcComponent) => Promise<void>> = {
    async sign(npc)
    {
        await say('', npc.text);
    },

    async elder()
    {
        if (!State.Has('sword'))
        {
            await say('Elder Rowan', 'Ah, you are awake at last. Listen well, child. Shadow creeps from the Dark Castle, and monsters roam our fields.');
            await say('Elder Rowan', 'Long ago, five sigils sealed the Dark Lord away. Four were hidden in the temples of this land. Gather them, and his castle will open to you.');
            await say('Elder Rowan', 'You cannot go alone and empty handed. Take this.');
            await give('sword');
            await startQuest('main');
            await say('Elder Rowan', elderHint());
            await say('Elder Rowan', 'Press ENTER to open your bag. Your quests are written there too.');
            return;
        }
        if (SaveData.sigils.has('d5'))
        {
            await say('Elder Rowan', 'The shadow is gone, and the sun shines on Elmore again. You are the hero of this land.');
            return;
        }
        await say('Elder Rowan', `You carry ${SaveData.sigils.size} of the five sigils. ${elderHint()}`);
        if (SaveData.hp < SaveData.maxHp)
        {
            State.Heal(SaveData.maxHp);
            Sfx('heart', 0.5);
            Burst(World.instance, 'magic', Center(World.instance.player));
            await say('Elder Rowan', 'You are hurt. Let me tend to your wounds... There.');
        }
    },

    async mina()
    {
        const quest = State.Quest('cat');
        if (quest == 'done')
        {
            await say('Mina', 'Whiskers has not left my side since you brought him back. Thank you!');
            return;
        }
        if (State.Flag('catFound'))
        {
            await say('Mina', 'Whiskers! He came running home! You found him, didn\'t you? Oh, thank you so much!');
            await say('Mina', 'Please, take this. My grandmother said it holds the strength of a hero.');
            await give('heartContainer');
            if (!quest)
                State.SetQuest('cat', 'active');
            finishQuest('cat');
            return;
        }
        if (!quest)
        {
            await say('Mina', 'Have you seen my cat, Whiskers? He chased a butterfly into the western woods and never came back...');
            const answer = await choose('Mina', 'Could you look for him? He loves the clearing full of flowers.', ['Of course', 'Not now']);
            if (answer == 0)
            {
                await startQuest('cat');
                await say('Mina', 'Thank you! Please be careful in the woods.');
            }
            else
                await say('Mina', 'Oh... I understand.');
            return;
        }
        await say('Mina', 'Whiskers loves the flower clearing in the south of the western woods. Please find him!');
    },

    async cat(npc)
    {
        await say('Whiskers', 'Meow?');
        State.SetFlag('catFound');
        State.Save();
        Sfx('secret', 0.4);
        await say('', 'Whiskers rubs against your leg, then dashes off toward the village.');
        Burst(World.instance, 'puff', Center(npc.go));
        npc.go.Remove();
    },

    async catHome()
    {
        await say('Whiskers', 'Purrrr...');
    },

    async guard()
    {
        const quest = State.Quest('slimes');
        if (quest == 'done')
        {
            await say('Bram', 'The fields are quiet thanks to you. Elmore owes you one.');
            return;
        }
        if (!quest)
        {
            await say('Bram', 'Halt! Ah, it\'s you. Slimes keep crawling out of the ground and eating the crops.');
            const answer = await choose('Bram', `Could you defeat ${SLIME_GOAL} of them? I'll make it worth your while.`, ['Sure', 'No']);
            if (answer == 0)
            {
                SaveData.slimesAtQuestStart = SaveData.slimesDefeated;
                await startQuest('slimes');
                await say('Bram', 'Good! You\'ll find plenty in the fields and the woods.');
            }
            return;
        }
        const done = SlimesForQuest();
        if (done >= SLIME_GOAL)
        {
            await say('Bram', `${SLIME_GOAL} slimes! You've earned this. Spend it wisely.`);
            await give('rupees', 100);
            finishQuest('slimes');
            return;
        }
        await say('Bram', `You've beaten ${done} slimes so far. ${SLIME_GOAL - done} to go!`);
    },

    async fisher()
    {
        const quest = State.Quest('ring');
        if (quest == 'done')
        {
            await say('Old Tom', 'The fish are biting today. Must be my lucky ring!');
            return;
        }
        if (State.Has('ring'))
        {
            await say('Old Tom', 'Is that... my ring! You found it in the shrine? Bless you, youngster.');
            SaveData.items.delete('ring');
            if (!quest)
                State.SetQuest('ring', 'active');
            await say('Old Tom', 'Here, take my lucky potion. And a few rupees for your trouble.');
            await give('potion', 1);
            State.AddRupees(50);
            Sfx('rupee', 0.4);
            finishQuest('ring');
            return;
        }
        if (!quest)
        {
            await say('Old Tom', 'Eh? Oh, hello. I was fishing near the Lake Shrine when my silver ring slipped into the water.');
            await say('Old Tom', 'The currents must have carried it inside the shrine. If you ever go in there, keep an eye out for it.');
            await startQuest('ring');
            return;
        }
        await say('Old Tom', 'My ring is somewhere in the Lake Shrine, on the north shore. The cracked rocks east of the lake block the way.');
    },

    async merchant()
    {
        const goods = [
            { name: 'Red Potion', price: 40, ok: () => SaveData.potions < MAX_POTIONS, buy: () => State.Give('potion', 1, '') },
            { name: '10 Arrows', price: 20, ok: () => State.Has('bow') && SaveData.arrows < MAX_ARROWS, buy: () => State.Give('arrows', 10, '') },
            { name: '5 Bombs', price: 25, ok: () => State.Has('bombs') && SaveData.bombs < MAX_BOMBS, buy: () => State.Give('bombRefill', 5, '') },
        ];
        const pick = await choose('Merchant', 'Welcome, welcome! What will it be?', [...goods.map(g => `${g.name} ${g.price}`), 'Leave']);
        const good = goods[pick];
        if (!good)
        {
            await say('Merchant', 'Come again!');
            return;
        }
        if (!good.ok())
        {
            await say('Merchant', good.name.includes('Potion') ? 'You can\'t carry another potion.' : 'You have no use for that right now, friend.');
            return;
        }
        if (SaveData.rupees < good.price)
        {
            Sfx('error', 0.4);
            await say('Merchant', 'Hmm, you don\'t have enough rupees for that.');
            return;
        }
        State.AddRupees(-good.price);
        good.buy();
        State.Save();
        Sfx('item', 0.5);
        await say('Merchant', 'A fine choice! Thank you!');
    },

    async kid()
    {
        const tips = [
            'Press Q or E to switch the item on K. I wish I had a bow!',
            'Bushes and pots sometimes hide rupees and hearts. Slash them!',
            'Grandpa says monsters hate getting knocked back. Hit and step away!',
            'If you get hurt, the elder can patch you up. He always does for me.',
            'They say a heart container hides behind a cracked rock in the east hills.',
        ];
        const index = Math.floor(SaveData.playTime / 20) % tips.length;
        await say('Pip', tips[index]);
    },
};

export async function Talk(npc: NpcComponent)
{
    const script = SCRIPTS[npc.who];
    if (script)
        await script(npc);
}
