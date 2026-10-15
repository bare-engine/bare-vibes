import { Component, GameObject, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { ContainsPoint } from '../golfEvents';
import { BallComponent } from './ballComponent';

// A ball whose center lands in the water goes back to where it was hit from, for a penalty stroke.
export class WaterComponent extends Component<ArcadeObject>
{
    // how far past the edge the ball's center has to be, so grazing the edge is safe
    @SerializeField
    margin = 4;

    override OnCollisionUpdate(other: GameObject)
    {
        const ball = other.GetComponent(BallComponent);
        if (!ball || ball.sunk || !ContainsPoint(this.go, other.x, other.y, this.margin))
            return;

        ball.Splash();
    }
}
