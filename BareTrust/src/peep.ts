import { Easing, GameObject } from 'bare-engine';
import { Outcome } from './payoffMatrix';

// iterated_peep FRAMES
const FACE_NORMAL = 1;
const FACE_BLINK = 2;
const FACE: Record<Outcome, int> = {
    [Outcome.Punishment]: 7,
    [Outcome.Reward]: 8,
    [Outcome.Sucker]: 9,
    [Outcome.Temptation]: 10,
};
const EYEBROWS: Record<Outcome, int> = {
    [Outcome.Punishment]: 3,
    [Outcome.Reward]: 4,
    [Outcome.Sucker]: 5,
    [Outcome.Temptation]: 6,
};

export class Peep extends GameObject
{
    animated!: GameObject; // MOVES TO THE MACHINE AND HOPS, EVERYTHING ELSE IS INSIDE
    coin!: GameObject;
    payoffCoins: GameObject[] = [];
    body!: GameObject;
    face!: GameObject;
    eyebrows!: GameObject;

    faceFrame: int = FACE_NORMAL;
    restingFace: boolean = true; // BLINKS WHEN RESTING
    isHopping: boolean = false;
    hopTimer: number = 0;

    // CALL RIGHT AFTER ADDING
    Build(): this
    {
        this.name = "peep";
        this.animated = this.AddChild().SetName("animated");

        // COINS FIRST, SO THEY'RE BEHIND THE BODY
        this.coin = this.AddCoin();
        for (var i = 0; i < 3; i++)
            this.payoffCoins.push(this.AddCoin());

        this.body = this.AddPeepFrame(0).SetName("body");
        this.face = this.AddPeepFrame(FACE_NORMAL).SetName("face");
        this.eyebrows = this.AddPeepFrame(EYEBROWS[Outcome.Reward]).SetName("eyebrows");
        this.eyebrows.visible = false;

        return this;
    }

    private AddCoin(): GameObject
    {
        var coin = this.animated.AddChild("iterated_coin")
            .SetName("coin")
            .CenterPivot()
            .SetScale(.5);
        coin.visible = false;
        return coin;
    }

    private AddPeepFrame(frame: int): GameObject
    {
        return this.animated.AddChild(Peep.PeepTexture(frame))
            .SetPivot(.5, .95) // FEET
            .SetScale(.5);
    }

    private static PeepTexture(frame: int)
    {
        return bare.asset.GetTexture("iterated_peep" + frame.toString().padStart(4, "0"));
    }

    SetFace(frame: int)
    {
        this.faceFrame = frame;
        this.face.SetTexture(Peep.PeepTexture(frame));
    }

    SetEyebrows(outcome: Outcome)
    {
        this.eyebrows.SetTexture(Peep.PeepTexture(EYEBROWS[outcome]));
        this.eyebrows.visible = true;
    }

    ResetFace()
    {
        this.eyebrows.visible = false;
        this.SetFace(FACE_NORMAL);
        this.restingFace = true;
    }

    override OnUpdate(deltaTime: number)
    {
        var ticks = deltaTime * 60;

        // BLINKING
        if (this.restingFace)
        {
            if (this.faceFrame > FACE_BLINK) this.SetFace(FACE_NORMAL);
            else if (this.faceFrame == FACE_BLINK && Math.random() < .2 * ticks) this.SetFace(FACE_NORMAL);
            else if (this.faceFrame == FACE_NORMAL && Math.random() < .01 * ticks) this.SetFace(FACE_BLINK);
        }

        // HOPPING
        if (this.isHopping)
        {
            this.hopTimer += ticks;
            this.animated.y = -Math.abs(Math.sin(this.hopTimer * .4)) * 6;
        }
        else
        {
            this.animated.y = 0;
            this.hopTimer = 0;
        }
    }

    // RESOLVES WHEN THE WHOLE ROUND ANIMATION IS DONE
    async PlayMove(outcome: Outcome): Promise<boolean>
    {
        var putsCoinIn = outcome == Outcome.Reward || outcome == Outcome.Sucker;
        var getsCoins = outcome == Outcome.Reward || outcome == Outcome.Temptation;

        // WHIP COIN OUT
        this.coin.visible = true;
        this.coin.SetPosition(10, -30);
        await this.TweenTo(this.coin, .1, { x: 60, y: -75, ease: Easing.Circular.Out });
        if (!await this.scene.Wait(.2))
            return false;

        // WALK TOWARDS MACHINE
        this.isHopping = true;
        await this.TweenTo(this.animated, .5, { x: 70, ease: Easing.Linear.None });
        this.isHopping = false;

        // PUT COIN IN OR DON'T - SHOW OUTCOME ON FACE
        if (putsCoinIn)
        {
            this.TweenTo(this.coin, .3, { x: 95, y: -25, ease: Easing.Circular.InOut }).then(() => {
                this.ShowOutcomeFace(outcome);
                this.coin.visible = false;
            });
        }
        else
        {
            this.TweenTo(this.coin, .3, { x: 70, y: -50, ease: Easing.Linear.None }).then(() => {
                this.ShowOutcomeFace(outcome);
                if (outcome == Outcome.Temptation)
                    this.isHopping = true; // HOPS WITH JOY
                this.TweenTo(this.coin, .1, { x: 50, y: -100, ease: Easing.Circular.Out });
            });
        }

        if (!await this.scene.Wait(outcome == Outcome.Reward ? .6 : .9))
            return false;

        // WALK BACK
        this.isHopping = true;
        await this.TweenTo(this.animated, .5, { x: 0, ease: Easing.Linear.None });
        this.isHopping = false;

        // FACE BACK TO NORMAL, EYEBROWS STAY
        this.restingFace = true;
        this.SetEyebrows(outcome);

        // PUT COIN AWAY IF NOT ALREADY
        if (this.coin.visible)
        {
            this.TweenTo(this.coin, .1, { x: 10, y: -30, ease: Easing.Circular.In }).then(() => {
                this.coin.visible = false;
            });
        }

        // COINS THROWN AT YOU
        if (getsCoins)
        {
            this.payoffCoins.forEach((c, i) => this.ThrowCoin(c, i * .2 + .1));
            if (!await this.scene.Wait(.8))
                return false;
        }
        else
        {
            if (!await this.scene.Wait(.3))
                return false;
        }
        return true;
    }

    private ShowOutcomeFace(outcome: Outcome)
    {
        this.restingFace = false;
        this.eyebrows.visible = false;
        this.SetFace(FACE[outcome]);
    }

    // FROM THE MACHINE, IN AN ARC, INTO THE PEEP
    private async ThrowCoin(coin: GameObject, delay: number)
    {
        coin.SetPosition(155, -25);
        if (!await this.scene.Wait(delay))
            return;

        coin.visible = true;
        this.TweenTo(coin, .3, { x: 0, ease: Easing.Linear.None }).then(() => {
            coin.visible = false;
        });
        await this.TweenTo(coin, .15, { y: -120, ease: Easing.Circular.Out });
        await this.TweenTo(coin, .15, { y: -20, ease: Easing.Circular.In });
    }

    private TweenTo(object: GameObject, seconds: number, props: any): Promise<unknown>
    {
        return this.scene.tween.To(object, seconds, props).promise;
    }
}
