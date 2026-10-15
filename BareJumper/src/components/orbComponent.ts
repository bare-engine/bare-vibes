import { Component, Easing, GameObject, ParticleComponent, TweenTo } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Asset } from '../generated/assets';
import { RunnerComponent } from './runnerComponent';

export class OrbComponent extends Component<ArcadeObject>
{
    override OnStart()
    {
        TweenTo(this.go, 0.6, { innerY: '-=8', ease: Easing.Sinusoidal.InOut, yoyo: true, repeat: -1, initialDelay: Math.random() * 0.6 });
    }

    override async OnCollisionStart(other: GameObject)
    {
        if (!other.HasComponent(RunnerComponent) || !this.go.collide)
            return;

        this.go.collide = false;
        bare.events.emit('orbCollected');
        bare.sound.PlayWithRandomRate(Asset.Sound.ORB, 0.05);
        this.go.GetComponent(ParticleComponent)?.Fire();

        // THE SPARKLE LIVES ON THIS OBJECT'S EMITTER, SO WAIT FOR IT BEFORE REMOVING
        TweenTo(this.go, 0.25, { innerScaleX: 1.8, innerScaleY: 1.8, alpha: 0 });
        if (!await this.scene.Wait(0.6))
            return;
        this.go.Remove();
    }
}
