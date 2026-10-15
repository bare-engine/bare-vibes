import { Component, GameObject, SerializeField } from 'bare-engine';
import { RigidBody, Type } from 'bare-engine/sopiro';
import { FACE_SPEEDS } from '../physics';

export type ShapeKind = 'neutral' | 'save' | 'kill' | 'hardkill';

// REGISTRATION POINTS OF THE ORIGINAL FACE CLIPS, AS A FRACTION OF THE IMAGE
const FACES = {
    face: { x: 0.5, y: 0.3636 },
    angry: { x: 0.4869, y: 0.4041 },
};

// ONE SHAPE FROM THE ORIGINAL: ITS COLOR (kind) DECIDES WHAT CLICKING IT DOES,
// AND MOVING SHAPES CARRY A FACE THAT REACTS TO THEIR SPEED
export class ShapeComponent extends Component<RigidBody>
{
    @SerializeField
    kind: ShapeKind = 'neutral';

    face: GameObject | null = null;
    private facePrefix: keyof typeof FACES = 'face';
    private faceFrame = 0;
    private faceLocked = false;
    // THE ORIGINAL TURNS A FACE SO ITS FEET POINT ALONG THE SHAPE'S GRAVITY
    private faceAngle = 0;

    get isStatic(): boolean
    {
        return this.go.type == Type.Static;
    }

    // RED AND BLUE POP WHEN CLICKED, GREEN AND DARK RED DON'T
    get clickable(): boolean
    {
        return this.kind == 'kill' || this.kind == 'neutral';
    }

    // RED AND DARK RED MUST BE GONE TO WIN
    get mustRemove(): boolean
    {
        return this.kind == 'kill' || this.kind == 'hardkill';
    }

    // |vx| + |vy|, LIKE THE ORIGINAL
    get speed(): number
    {
        const v = this.go.linearVelocity;
        return Math.abs(v.x) + Math.abs(v.y);
    }

    override OnStart()
    {
        // FIXED SHAPES HAVE NO FACE
        if (this.isStatic)
            return;

        // ITS OWN OBJECT, NOT A CHILD: SHAPES ARE SCALED TO THEIR SIZE (EG 75 x 50), WHICH WOULD STRETCH
        // A CHILD, AND SKEW IT WHEN TURNED. THE FACES LAYER IS ABOVE THE SHAPES
        this.facePrefix = this.mustRemove ? 'angry' : 'face';
        this.face = this.scene.AddGameObject(this.facePrefix + '1', 'faces').SetScale(0.5);
        this.face.SetPivot(FACES[this.facePrefix].x, FACES[this.facePrefix].y);
        this.faceFrame = 1;

        const g = this.go.gravity;
        this.faceAngle = g ? Math.atan2(g.y, g.x) * 180 / Math.PI - 90 : 0;

        this.UpdateFace();
    }

    override OnRemoved()
    {
        this.face?.Remove();
        this.face = null;
        this.faceLocked = false;
    }

    override OnUpdate()
    {
        this.UpdateFace();
    }

    // THE BIG GRIN THE ORIGINAL SHOWS ON EVERY SHAPE WHEN A LEVEL IS PASSED
    Cheer()
    {
        this.SetFaceFrame(4);
        this.faceLocked = true;
    }

    private UpdateFace()
    {
        if (!this.face)
            return;

        // THE FACE KEEPS ITS ANGLE WHILE THE SHAPE ROTATES, AS IN THE ORIGINAL
        this.face.SetPosition(this.go.x, this.go.y);
        this.face.rotation = this.faceAngle;

        if (this.faceLocked)
            return;

        const speed = this.speed;
        const frame = FACE_SPEEDS.findIndex(limit => speed < limit) + 1;

        // ABOVE THE LAST LIMIT THE ORIGINAL KEEPS WHATEVER FRAME IT HAD
        if (frame > 0)
            this.SetFaceFrame(frame);
    }

    private SetFaceFrame(frame: number)
    {
        if (!this.face || frame == this.faceFrame)
            return;

        this.faceFrame = frame;
        this.face.InitTexture(this.facePrefix + frame);
    }
}
