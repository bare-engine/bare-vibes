import { BareEvent, BlockedState, Component, Easing, GameObject, Inspector, InspectorField, ParticleComponent, SerializeField, TweenTo } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Asset } from '../generated/assets';
import { GHOST_STEP } from '../progress';

export enum RunnerState { Ready, Running, Dead, Finished }

const FLIP_KEYS = new Set(['space', 'arrowUp', 'arrowDown', 'w', 's', 'z', 'x']);

// RUNS RIGHT ON ITS OWN, FLIPS GRAVITY ON A PRESS.
// ARCADE GRAVITY IS GLOBAL, SO settingsData.gravity IS 0 AND THIS INTEGRATES ITS OWN
export class RunnerComponent extends Component<ArcadeObject>
{
    @SerializeField
    @Inspector.Limit(0, Infinity)
    gravity = 5200;

    @SerializeField
    maxFallSpeed = 1700;

    // SECONDS A PRESS IS REMEMBERED BEFORE LANDING, AND A FLIP IS STILL ALLOWED AFTER LEAVING THE GROUND
    @SerializeField
    inputBuffer = 0.12;

    @SerializeField
    coyoteTime = 0.08;

    @InspectorField
    speed = 400;

    @InspectorField
    direction = 1;

    state = RunnerState.Ready;
    ghost: number[] = [];

    bufferLeft = 0;
    private sinceGrounded = Infinity;
    private wasGrounded = true;
    private steps = 0;

    override OnStart()
    {
        this.speed = bare.level.currentLevel?.customData?.speed ?? this.speed;
        this.go.GetComponent(ParticleComponent)?.emitter.stop();
    }

    // FLIPS COME FROM EVENTS, NOT bare.keyboard.IsKeyPressed / bare.mouse.IsPressed: THOSE MISS A
    // PRESS THAT IS RELEASED WITHIN THE SAME FRAME, LIKE A QUICK TAP ON A SLOW PHONE
    override OnAdded()
    {
        bare.events.on(BareEvent.key_pressed, this.OnKeyPressed);
        bare.events.on(BareEvent.pointer_down, this.OnPress);
    }

    override OnRemoved()
    {
        bare.events.off(BareEvent.key_pressed, this.OnKeyPressed);
        bare.events.off(BareEvent.pointer_down, this.OnPress);
    }

    private OnKeyPressed = ({ key }: { key: string }) =>
    {
        if (FLIP_KEYS.has(key))
            this.OnPress();
    };

    private OnPress = () =>
    {
        if (this.state == RunnerState.Ready)
            this.Begin();
        else if (this.state == RunnerState.Running)
            this.bufferLeft = this.inputBuffer;
    };

    override OnUpdate(deltaTime: number)
    {
        this.bufferLeft -= deltaTime;
    }

    Begin()
    {
        this.state = RunnerState.Running;
        this.go.GetComponent(ParticleComponent)?.emitter.start();
    }

    override OnFixedUpdate(dt: number)
    {
        if (this.state != RunnerState.Running)
            return;

        const go = this.go;
        const grounded = go.IsBlocked(this.direction > 0 ? BlockedState.Down : BlockedState.Up);

        if (grounded)
        {
            this.sinceGrounded = 0;
            if (!this.wasGrounded)
                this.Land();
        }
        else
            this.sinceGrounded += dt;
        this.wasGrounded = grounded;

        if (this.bufferLeft > 0 && this.sinceGrounded <= this.coyoteTime)
            this.Flip();

        go.velocity.x = this.speed;
        go.velocity.y = bare.util.Clamp(go.velocity.y + this.gravity * this.direction * dt, -this.maxFallSpeed, this.maxFallSpeed);

        if (go.IsBlocked(BlockedState.Right))
            return this.Die();

        const height = bare.level.currentLevel?.dimensions.height ?? bare.height;
        if (go.y < -go.height || go.y > height + go.height)
            return this.Die();

        if (this.steps++ % GHOST_STEP == 0)
            this.ghost.push(Math.round(go.x), Math.round(go.y), this.direction);
    }

    private Flip()
    {
        this.bufferLeft = 0;
        this.sinceGrounded = Infinity;
        this.wasGrounded = false;
        this.direction *= -1;

        // A LITTLE PUSH OFF THE GROUND, SO THE FLIP STARTS RIGHT AWAY
        this.go.velocity.y = this.direction * 250;

        TweenTo(this.go, 0.14, { innerScaleY: this.direction, innerScaleX: 1, ease: Easing.Back.Out });
        bare.events.emit('playerFlipped', { direction: this.direction });
    }

    private Land()
    {
        bare.sound.Play(Asset.Sound.LAND, { volume: 0.5 });
        TweenTo(this.go, 0.07, { innerScaleY: this.direction * 0.7, innerScaleX: 1.3, yoyo: true, repeat: 1, ease: Easing.Quadratic.Out });
    }

    override OnCollisionStart(other: GameObject)
    {
        if (this.state != RunnerState.Running)
            return;

        if (other.tags.includes('hazard'))
            this.Die();
        else if (other.tags.includes('goal'))
            this.Finish();
    }

    private Die()
    {
        this.state = RunnerState.Dead;
        this.go.ResetVelocity();
        this.go.visible = false;
        this.go.collide = false;
        this.go.GetComponent(ParticleComponent)?.emitter.stop();
        bare.events.emit('playerDied');
    }

    private Finish()
    {
        this.state = RunnerState.Finished;
        this.go.GetComponent(ParticleComponent)?.emitter.stop();
        TweenTo(this.go, 0.4, { innerScaleX: 0, innerScaleY: 0, innerRotation: 360, ease: Easing.Back.In });
        bare.events.emit('levelComplete');
    }

}
