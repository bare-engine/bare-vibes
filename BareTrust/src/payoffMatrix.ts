export enum Choice { Cooperate = 0, Cheat = 1 }

// MERGES WITH THE ENUM, SO Choice.Random() WORKS NEXT TO Choice.Cooperate / Choice.Cheat
export namespace Choice
{
    export function Random(): Choice
    {
        return Math.random() < .5 ? Choice.Cooperate : Choice.Cheat;
    }
}

// WHAT HAPPENED TO ONE PLAYER, SEEN FROM THEIR SIDE - DRIVES THE PEEP ANIMATION
export enum Outcome { Reward, Sucker, Temptation, Punishment }

export type Payoff = [you: number, them: number];

export class PayoffMatrix
{
    // PAYOFFS[yourChoice][theirChoice]
    static readonly PAYOFFS: Payoff[][] = [
        //  they Cooperate   they Cheat
        [   [ 2,  2],        [-1,  3] ],   // you Cooperate
        [   [ 3, -1],        [ 0,  0] ],   // you Cheat
    ];

    static Get(you: Choice, them: Choice): Payoff
    {
        return PayoffMatrix.PAYOFFS[you][them];
    }

    static GetOutcome(you: Choice, them: Choice): Outcome
    {
        if (you == Choice.Cooperate)
            return them == Choice.Cooperate ? Outcome.Reward : Outcome.Sucker;

        return them == Choice.Cooperate ? Outcome.Temptation : Outcome.Punishment;
    }
}
