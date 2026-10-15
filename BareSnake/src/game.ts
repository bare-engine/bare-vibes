import { Color, Easing, GameObject, Scene, StartBare, TextObject, Vec2 } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { Snake } from './snake';

export class Game extends Scene
{
    snake!: Snake;
    apple!: GameObject;
    scoreText!: TextObject;
    score: number = 0;

    eatDistance: number = 50;
    deathPause: number = .8;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    // CREATE UI
    // THIS HAPPENS ONCE, NOT CALLED ON RESTART
    override OnAwake()
    {
        this.scoreText = bare.uiScene.AddGameObject(new TextObject(bare.uiScene, {
            text: 'Score: 0',
            fontSize: 40,
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
        })).SetPosition(24, 16);
    }

    override OnStart()
    {
        this.snake = this.AddGameObject(Snake)
            .Setup(bare.width * .5, bare.height * .5);

        this.apple = this.AddGameObject('apple')
            .SetPivot(.5, .6)

        this.SpawnApple();

        this.SetScore(0);
    }

    override OnUpdate()
    {
        const head = this.snake.headPosition;

        // HIT AN EDGE OR ITSELF? DIE
        if (head.x < 0 || head.x > bare.width || head.y < 0 || head.y > bare.height || this.snake.HitsSelf())
        {
            this.Die();
            return;
        }

        // EAT THE APPLE
        if (head.distanceTo(this.apple.position) < this.eatDistance)
        {
            this.EatAppleEffect(this.apple.position.clone());
            this.snake.Grow();
            this.SetScore(this.score + 1);
            this.SpawnApple();
        }
    }

    async Die()
    {
        this.snake.SetColor(Color.fromHex('#ff5858'));
        await this.Sleep(this.deathPause); // SMALL PAUSE
        this.Restart();
    }

    // POP A COPY OF THE EATEN APPLE UP, THEN SHRINK IT INTO THE SNAKE'S HEAD
    async EatAppleEffect(position: Vec2)
    {
        const startScale = this.apple.scaleX;
        const apple = this.AddGameObject('apple')
            .SetScale(startScale)
            .SetPivot(this.apple.pivotX, this.apple.pivotY)
            .SetPosition(position.x, position.y);

        const popScale = startScale * 1.4;
        await this.tween.To(apple, .12, { scaleX: popScale, scaleY: popScale, ease: Easing.Back.Out }).promise;

        // LERP TOWARD THE HEAD EVERY FRAME, IT KEEPS MOVING WHILE THE APPLE FLIES IN
        const fly = { t: 0 };
        await this.tween.To(fly, .25, {
            t: 1,
            ease: Easing.Quadratic.In,
            onUpdate: () => {
                const head = this.snake.headPosition;
                apple.SetPosition(
                    position.x + (head.x - position.x) * fly.t,
                    position.y + (head.y - position.y) * fly.t,
                );
                apple.SetScale(popScale * (1 - fly.t));
            },
        }).promise;

        apple.Remove();
    }

    // MOVE THE APPLE TO A RANDOM SPOT AWAY FROM THE EDGES AND THE SNAKE
    SpawnApple()
    {
        const margin = 80;
        let position = new Vec2();

        // GIVE UP AFTER A WHILE, A FULL SCREEN HAS NO FREE SPOT
        for (let attempt = 0; attempt < 100; attempt++)
        {
            position = new Vec2(
                bare.util.RandomRange(margin, bare.width - margin),
                bare.util.RandomRange(margin, bare.height - margin),
            );

            if (!this.snake.IsNear(position, this.snake.lineWidth))
                break;
        }

        this.apple.SetPosition(position.x, position.y);
    }

    SetScore(score: number)
    {
        this.score = score;
        this.scoreText.SetText(`Score: ${score}`);
    }
}

StartBare(Game);
