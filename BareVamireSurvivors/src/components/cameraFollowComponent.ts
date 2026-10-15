import { Component, Inspector, InspectorField, SerializeField } from 'bare-engine';
import type { ArcadeObject } from 'bare-engine/arcade';

// Smooth camera follow with look-ahead, zoom (mouse wheel, - and =, 0 to reset) and an
// overview zoom (Z). The arena's level sets the camera bounds, so it stops at the edges.
export class CameraFollowComponent extends Component<ArcadeObject>
{
    // How tightly the camera follows; higher is tighter
    @SerializeField
    @Inspector.Limit(0.1, 50)
    smoothing = 6;

    // Seconds of movement to look ahead of the player
    @SerializeField
    lookAhead = 0.3;

    @SerializeField minZoom = 0.25;
    @SerializeField maxZoom = 3;

    @InspectorField zoomTarget = 1;
    @InspectorField overview = false;

    private zoomBeforeOverview = 1;
    private lookX = 0;
    private lookY = 0;

    override OnStart()
    {
        bare.camera.SetZoom(this.zoomTarget);
        bare.camera.SetPosition(this.go.x, this.go.y);
    }

    override OnUpdate(dt: number)
    {
        const camera = bare.camera;
        const keyboard = bare.keyboard;

        if (keyboard.IsKeyDown('=') || keyboard.IsKeyDown('+'))
            this.zoomTarget = this.ClampZoom(this.zoomTarget * (1 + dt * 1.5));
        if (keyboard.IsKeyDown('-'))
            this.zoomTarget = this.ClampZoom(this.zoomTarget / (1 + dt * 1.5));
        if (bare.mouse.wheelDelta !== 0 && !this.overview)
            this.zoomTarget = this.ClampZoom(this.zoomTarget * Math.pow(0.999, bare.mouse.wheelDelta));
        if (keyboard.IsKeyPressed('0'))
            this.zoomTarget = 1;
        if (keyboard.IsKeyPressed('z'))
            this.ToggleOverview();

        // Zoom smoothly towards the target, then follow
        const zoomT = 1 - Math.exp(-8 * dt);
        camera.SetZoom(camera.GetZoom() + (this.zoomTarget - camera.GetZoom()) * zoomT);

        const lookT = 1 - Math.exp(-3 * dt);
        this.lookX += (this.go.velocity.x * this.lookAhead - this.lookX) * lookT;
        this.lookY += (this.go.velocity.y * this.lookAhead - this.lookY) * lookT;

        const position = camera.GetPosition();
        const t = 1 - Math.exp(-this.smoothing * dt);
        camera.SetPosition(
            bare.util.Lerp(position.x, this.go.x + this.lookX, t),
            bare.util.Lerp(position.y, this.go.y + this.lookY, t),
        );
    }

    ToggleOverview()
    {
        this.overview = !this.overview;
        if (this.overview)
        {
            this.zoomBeforeOverview = this.zoomTarget;
            this.zoomTarget = this.minZoom;
        }
        else
            this.zoomTarget = this.zoomBeforeOverview;
    }

    private ClampZoom(zoom: number): number
    {
        return Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
    }
}
