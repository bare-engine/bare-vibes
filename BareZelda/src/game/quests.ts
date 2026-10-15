import { SaveData } from 'bare-engine';
import { State } from './state';

export const SLIME_GOAL = 8;

export interface QuestInfo
{
    title: string;
    // WHAT TO DO NEXT, OR HOW IT ENDED
    describe(): string;
}

export const QUESTS: Record<string, QuestInfo> = {
    main: {
        title: 'The Five Sigils',
        describe()
        {
            const s = SaveData.sigils;
            if (s.has('d5')) return 'The Dark Lord is gone. Elmore is safe.';
            if (!s.has('d1')) return 'Find the Forest Temple, west through the woods.';
            if (!s.has('d2')) return 'Shoot the stone eye east of the village, then find the Stone Cavern.';
            if (!s.has('d3')) return 'Bomb the cracked rocks by the lake and enter the Lake Shrine on the north shore.';
            if (!s.has('d4')) return 'Swim the river east of the lake to reach the Ember Fortress.';
            return 'Burn the thorns north of the forest and break the seal of the Dark Castle.';
        },
    },
    cat: {
        title: 'Whiskers is Missing',
        describe()
        {
            if (State.Quest('cat') == 'done') return 'Mina and Whiskers are together again.';
            if (State.Flag('catFound')) return 'Whiskers went home. Tell Mina!';
            return "Mina's cat ran into the western woods. Look for a clearing full of flowers.";
        },
    },
    slimes: {
        title: 'Slime Trouble',
        describe()
        {
            if (State.Quest('slimes') == 'done') return 'Bram thanked you for clearing the fields.';
            return `Defeat slimes for Bram the guard: ${Math.min(SLIME_GOAL, SlimesForQuest())}/${SLIME_GOAL}.`;
        },
    },
    ring: {
        title: "The Fisher's Ring",
        describe()
        {
            if (State.Quest('ring') == 'done') return 'Old Tom has his ring back.';
            if (State.Has('ring')) return 'Bring the ring back to Old Tom on the pier.';
            return 'Old Tom lost his ring in the Lake Shrine.';
        },
    },
};

export function SlimesForQuest(): number
{
    return SaveData.slimesDefeated - SaveData.slimesAtQuestStart;
}
