import { Component } from 'bare-engine';
import { CarComponent } from './carComponent';

// arrows or WASD to drive, space for the handbrake
export class PlayerDriverComponent extends Component
{
    private car!: CarComponent;

    override OnStart()
    {
        this.car = this.go.GetComponent(CarComponent)!;
    }

    override OnUpdate()
    {
        const keyboard = bare.keyboard;
        this.car.throttle = Number(keyboard.IsUpDown()) - Number(keyboard.IsDownDown());
        this.car.steer = Number(keyboard.IsRightDown()) - Number(keyboard.IsLeftDown());
        this.car.handbrake = keyboard.IsKeyDown('space');
    }

    override OnRemoved()
    {
        this.car.throttle = 0;
        this.car.steer = 0;
        this.car.handbrake = false;
    }
}
