import { Component } from 'bare-engine';
import type { Track } from '../track';

// a car passes a waypoint when it's past the line through it, and close enough that it
// can't count a stretch of road it skipped over the grass
const PASS_DISTANCE = 200;

// counts the waypoints and laps a car has driven
export class RacerComponent extends Component
{
    track!: Track;
    laps = 3;

    // waypoints passed since the start. Waypoint 0 is the finish line, which every car starts behind
    passed = 0;
    nextWaypoint = 0;
    finishTime: number | null = null;

    get driver(): string
    {
        return this.go.customData.driver ?? this.go.name;
    }

    get finished(): boolean
    {
        return this.finishTime != null;
    }

    // 1 to laps
    get lap(): number
    {
        const count = this.track.waypoints.length;
        return Math.min(this.laps, Math.max(1, Math.floor((this.passed - 1) / count) + 1));
    }

    // waypoints passed plus how far toward the next one, to rank cars
    get progress(): number
    {
        const next = this.track.waypoints[this.nextWaypoint];
        const prev = this.track.waypoints[this.track.Prev(this.nextWaypoint)];
        const segment = Math.hypot(next.x - prev.x, next.y - prev.y);
        const left = Math.hypot(next.x - this.go.x, next.y - this.go.y);
        return this.passed + Math.max(0, Math.min(1, 1 - left / segment));
    }

    // returns true when this update crossed the finish line for the last time
    CheckProgress(raceTime: number): boolean
    {
        const next = this.track.waypoints[this.nextWaypoint];
        const prev = this.track.waypoints[this.track.Prev(this.nextWaypoint)];
        const dx = this.go.x - next.x;
        const dy = this.go.y - next.y;
        const distance = Math.hypot(dx, dy);
        const pastLine = dx * (next.x - prev.x) + dy * (next.y - prev.y) >= 0;

        if (distance > PASS_DISTANCE || !(pastLine || distance < 50))
            return false;

        // after the finish the waypoints still advance, for the AI driving its lap of honor
        this.nextWaypoint = this.track.Next(this.nextWaypoint);
        if (this.finished)
            return false;

        this.passed++;

        // crossing the line a first time starts lap 1, so the race is done after laps + 1 crossings
        if (this.passed == this.laps * this.track.waypoints.length + 1)
        {
            this.finishTime = raceTime;
            return true;
        }
        return false;
    }
}
