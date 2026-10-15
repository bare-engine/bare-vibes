import type { Building } from './building';
import type { Colony } from './colony';
import { GoalAt, IsAtGoal, type Goal } from './pathfinding';
import { BERRIES } from './items';
import { RES_ITEM, RES_WORK_TICKS, RES_YIELD, R_NONE } from './world';

export type JobType = 'harvest' | 'supply' | 'construct' | 'haul' | 'farm' | 'eat' | 'deposit' | 'wander';

export interface Job
{
    type: JobType;
    // a tile index for harvest and wander, a building id otherwise
    target: number;
    item: number;
    // items reserved at the target (supply)
    count: number;
    storage: number;
    stage: number;
    work: number;
}

export const CARRY_CAP = 6;
const SPEED = 0.11;
const HUNGRY_SPEED = 0.06;
const FARM_WORK_TICKS = 30;

const WALKING = 0;
const ARRIVED = 1;
const FAILED = 2;
type Travel = typeof WALKING | typeof ARRIVED | typeof FAILED;

const DONE = 1;
const ABORT = 2;
type JobResult = typeof WALKING | typeof DONE | typeof ABORT;

export class Worker
{
    // position in tiles; a tile's center is at +0.5
    x: number;
    y: number;
    // position at the start of the tick, to draw between ticks
    px: number;
    py: number;

    path: Int32Array | null = null;
    pathPos = 0;
    private flowNext = -1;
    private depositTarget = 0;
    private travelFailed = false;

    job: Job | null = null;
    carryItem = 0;
    carryCount = 0;
    hunger = 0;
    nextJobSearch = 0;

    moving = false;
    working = false;
    facing = 1;

    constructor(readonly id: number, readonly name: string, readonly shirt: number, tileX: number, tileY: number)
    {
        this.x = this.px = tileX + 0.5;
        this.y = this.py = tileY + 0.5;
    }

    get tileX(): number { return Math.floor(this.x); }
    get tileY(): number { return Math.floor(this.y); }

    get speed(): number { return this.hunger >= 90 ? HUNGRY_SPEED : SPEED; }

    Describe(c: Colony): string
    {
        const job = this.job;
        if (!job)
            return this.carryCount > 0 ? 'Looking for storage' : 'Idle';
        switch (job.type)
        {
            case 'harvest': return job.stage < 2 ? 'Harvesting' : 'Bringing harvest home';
            case 'supply': return `Fetching ${c.ItemLabel(job.item).toLowerCase()} for ${c.buildings.get(job.target)?.def.label ?? '?'}`;
            case 'construct': return `Building ${c.buildings.get(job.target)?.def.label ?? '?'}`;
            case 'haul': return 'Hauling products';
            case 'farm': return 'Picking berries';
            case 'eat': return 'Getting a snack';
            case 'deposit': return 'Storing items';
            case 'wander': return 'Strolling';
        }
    }

    Update(c: Colony)
    {
        this.px = this.x;
        this.py = this.y;
        this.moving = false;
        this.working = false;

        if (c.tick % 30 === 0 && this.hunger < 100)
            this.hunger++;

        if (!this.job)
        {
            if (c.tick < this.nextJobSearch || c.jobBudget <= 0)
                return;
            c.jobBudget--;

            if (this.carryCount > 0)
                this.job = c.MakeJob('deposit', 0);
            else
                this.job = c.FindJob(this);

            if (!this.job)
            {
                this.nextJobSearch = c.tick + 15 + c.rng.Int(15);
                return;
            }
            this.path = null;
            this.flowNext = -1;
            this.depositTarget = 0;
        }

        const job = this.job;
        this.travelFailed = false;
        const result = this.RunJob(c, job);
        if (result !== WALKING)
        {
            c.ReleaseJob(this, job);
            // don't let the next idle worker walk into the same wall
            if (result === ABORT && this.travelFailed)
                c.MarkUnreachable(job);
            this.job = null;
            this.path = null;
            if (result === ABORT)
                this.nextJobSearch = c.tick + 20 + c.rng.Int(20);
        }
    }

    // drop the current job, eg after loading or when its target goes away
    Abort(c: Colony)
    {
        if (this.job)
            c.ReleaseJob(this, this.job);
        this.job = null;
        this.path = null;
    }

    private RunJob(c: Colony, job: Job): JobResult
    {
        switch (job.type)
        {
            case 'harvest': return this.RunHarvest(c, job);
            case 'supply': return this.RunSupply(c, job);
            case 'construct': return this.RunConstruct(c, job);
            case 'haul': return this.RunHaul(c, job);
            case 'farm': return this.RunFarm(c, job);
            case 'eat': return this.RunEat(c, job);
            case 'deposit': return this.RunDeposit(c);
            case 'wander': return this.RunWander(c, job);
        }
    }

    private RunHarvest(c: Colony, job: Job): JobResult
    {
        const world = c.world;
        const t = job.target;
        if (job.stage < 2 && (world.res[t] === R_NONE || !world.designated[t]))
            return ABORT;

        if (job.stage === 0)
        {
            const travel = this.Travel(c, GoalAt(t % world.w, (t / world.w) | 0));
            if (travel === FAILED) return ABORT;
            if (travel === ARRIVED) { job.stage = 1; job.work = 0; }
            return WALKING;
        }
        if (job.stage === 1)
        {
            this.working = true;
            this.FaceTile(c, t);
            if (++job.work < RES_WORK_TICKS[world.res[t]])
                return WALKING;
            const res = world.res[t];
            const amount = Math.min(RES_YIELD[res], world.resAmount[t]);
            c.Harvest(t, amount);
            this.carryItem = RES_ITEM[res];
            this.carryCount = amount;
            job.stage = 2;
            return WALKING;
        }
        return this.RunDeposit(c);
    }

    private RunSupply(c: Colony, job: Job): JobResult
    {
        const target = c.buildings.get(job.target);
        if (!target)
            return ABORT;

        if (job.stage === 0)
        {
            let storage = c.buildings.get(job.storage);
            if (!storage || storage.inv[job.item] === 0)
            {
                storage = c.NearestStorageWith(this.tileX, this.tileY, job.item) ?? undefined;
                if (!storage) return ABORT;
                job.storage = storage.id;
            }
            const travel = this.Travel(c, this.GoalOf(storage));
            if (travel === FAILED) return ABORT;
            if (travel !== ARRIVED) return WALKING;

            const taken = c.TakeFrom(storage, job.item, job.count);
            if (taken === 0)
                return ABORT;
            // only keep reserved what was actually picked up
            target.incoming[job.item] -= job.count - taken;
            job.count = taken;
            this.carryItem = job.item;
            this.carryCount = taken;
            job.stage = 1;
            return WALKING;
        }

        const travel = this.Travel(c, this.GoalOf(target));
        if (travel === FAILED) return ABORT;
        if (travel !== ARRIVED) return WALKING;
        this.carryCount -= c.DeliverTo(target, this.carryItem, this.carryCount);
        if (this.carryCount === 0)
            this.carryItem = 0;
        return DONE;
    }

    private RunConstruct(c: Colony, job: Job): JobResult
    {
        const site = c.buildings.get(job.target);
        if (!site || site.built || !site.MaterialsComplete())
            return ABORT;

        if (job.stage === 0)
        {
            const travel = this.Travel(c, this.GoalOf(site));
            if (travel === FAILED) return ABORT;
            if (travel === ARRIVED) job.stage = 1;
            return WALKING;
        }

        this.working = true;
        this.FaceBuilding(site);
        if (++site.buildWork >= site.def.buildTicks)
        {
            c.CompleteBuilding(site);
            return DONE;
        }
        return WALKING;
    }

    private RunHaul(c: Colony, job: Job): JobResult
    {
        if (job.stage === 0)
        {
            const b = c.buildings.get(job.target);
            if (!b)
                return ABORT;
            const travel = this.Travel(c, this.GoalOf(b));
            if (travel === FAILED) return ABORT;
            if (travel !== ARRIVED) return WALKING;
            const taken = Math.min(b.out, CARRY_CAP);
            if (taken === 0)
                return DONE;
            b.out -= taken;
            this.carryItem = b.outItem;
            this.carryCount = taken;
            job.stage = 1;
            return WALKING;
        }
        return this.RunDeposit(c);
    }

    private RunFarm(c: Colony, job: Job): JobResult
    {
        if (job.stage < 2)
        {
            const farm = c.buildings.get(job.target);
            if (!farm || farm.stage < 2)
                return ABORT;
            if (job.stage === 0)
            {
                const travel = this.Travel(c, this.GoalOf(farm));
                if (travel === FAILED) return ABORT;
                if (travel === ARRIVED) { job.stage = 1; job.work = 0; }
                return WALKING;
            }
            this.working = true;
            this.FaceBuilding(farm);
            if (++job.work < FARM_WORK_TICKS)
                return WALKING;
            this.carryItem = BERRIES;
            this.carryCount = farm.def.yieldCount;
            c.produced[BERRIES] += farm.def.yieldCount;
            farm.stage = 0;
            farm.growth = 0;
            job.stage = 2;
            return WALKING;
        }
        return this.RunDeposit(c);
    }

    private RunEat(c: Colony, job: Job): JobResult
    {
        let storage = c.buildings.get(job.storage);
        if (!storage || storage.inv[BERRIES] === 0)
        {
            storage = c.NearestStorageWith(this.tileX, this.tileY, BERRIES) ?? undefined;
            if (!storage) return ABORT;
            job.storage = storage.id;
        }
        const travel = this.Travel(c, this.GoalOf(storage));
        if (travel === FAILED) return ABORT;
        if (travel !== ARRIVED) return WALKING;
        if (c.TakeFrom(storage, BERRIES, 1) === 0)
            return ABORT;
        this.hunger = 0;
        return DONE;
    }

    // walk to the nearest storage along the flow field, and put down what's carried
    private RunDeposit(c: Colony): JobResult
    {
        if (this.carryCount === 0)
            return DONE;

        const storage = c.StorageNextTo(this.tileX, this.tileY);
        if (storage && this.MoveTowardCenter())
        {
            c.StoreAt(storage, this.carryItem, this.carryCount);
            this.carryCount = 0;
            this.carryItem = 0;
            return DONE;
        }
        if (storage)
            return WALKING;

        // out of the flow field's reach: search the way to the nearest storage instead
        if (this.depositTarget)
        {
            const target = c.buildings.get(this.depositTarget);
            if (!target)
            {
                this.depositTarget = 0;
                this.path = null;
                return WALKING;
            }
            return this.Travel(c, this.GoalOf(target)) === FAILED ? ABORT : WALKING;
        }

        const here = this.tileY * c.world.w + this.tileX;
        if (this.flowNext === -1 || this.flowNext === here)
        {
            const next = c.flow.Next(this.tileX, this.tileY);
            if (next === -1 || next === here)
            {
                // the field is being rebuilt: wait for it
                if (!c.flow.ready)
                    return WALKING;
                const nearest = c.NearestStorage(this.tileX, this.tileY);
                if (!nearest)
                    return ABORT;
                this.depositTarget = nearest.id;
                this.path = null;
                return WALKING;
            }
            this.flowNext = next;
        }
        if (!c.world.Walkable(this.flowNext))
        {
            this.flowNext = -1;
            return WALKING;
        }
        if (this.MoveToward(c, this.flowNext))
            this.flowNext = -1;
        return WALKING;
    }

    private RunWander(c: Colony, job: Job): JobResult
    {
        const w = c.world.w;
        const travel = this.Travel(c, GoalAt(job.target % w, (job.target / w) | 0, 1, 1, false));
        return travel === WALKING ? WALKING : DONE;
    }

    private GoalOf(b: Building): Goal
    {
        return GoalAt(b.x, b.y, b.def.w, b.def.h);
    }

    private Travel(c: Colony, goal: Goal): Travel
    {
        if (!this.path)
        {
            if (IsAtGoal(this.tileX, this.tileY, goal))
                return this.MoveTowardCenter() ? ARRIVED : WALKING;
            // searches are spread over ticks: wait for a turn
            if (c.pathBudget <= 0)
                return WALKING;
            c.pathBudget--;
            const path = c.pathfinder.Find(this.tileX, this.tileY, goal);
            if (!path)
            {
                this.travelFailed = true;
                return FAILED;
            }
            this.path = path;
            this.pathPos = 0;
        }

        if (this.pathPos >= this.path.length)
        {
            this.path = null;
            return IsAtGoal(this.tileX, this.tileY, goal) ? ARRIVED : WALKING;
        }

        const next = this.path[this.pathPos];
        if (!c.world.Walkable(next))
        {
            // something was built in the way: search again
            this.path = null;
            return WALKING;
        }
        if (this.MoveToward(c, next))
            this.pathPos++;
        return WALKING;
    }

    private MoveToward(c: Colony, tile: number): boolean
    {
        const w = c.world.w;
        const tx = (tile % w) + 0.5, ty = ((tile / w) | 0) + 0.5;
        return this.StepTo(tx, ty);
    }

    private MoveTowardCenter(): boolean
    {
        return this.StepTo(this.tileX + 0.5, this.tileY + 0.5);
    }

    private StepTo(tx: number, ty: number): boolean
    {
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        const speed = this.speed;
        if (dist <= speed)
        {
            this.x = tx;
            this.y = ty;
            return true;
        }
        this.x += (dx / dist) * speed;
        this.y += (dy / dist) * speed;
        this.moving = true;
        if (Math.abs(dx) > 0.01)
            this.facing = dx > 0 ? 1 : -1;
        return false;
    }

    private FaceTile(c: Colony, tile: number)
    {
        const tx = (tile % c.world.w) + 0.5;
        if (Math.abs(tx - this.x) > 0.01)
            this.facing = tx > this.x ? 1 : -1;
    }

    private FaceBuilding(b: Building)
    {
        const cx = b.x + b.def.w / 2;
        if (Math.abs(cx - this.x) > 0.01)
            this.facing = cx > this.x ? 1 : -1;
    }
}
