import { Button, Color, GameObject, SaveData, Scene, TextObject, TweenTo, Vec2 } from 'bare-engine';
import { MAP_WIDTH, TOWER_TYPES } from './constants';
import type { Game } from './game';
import { Asset } from './generated/assets';

const PANEL_X = MAP_WIDTH;
const PANEL_WIDTH = 1280 - MAP_WIDTH;
const CENTER_X = PANEL_X + PANEL_WIDTH / 2;

const PANEL_COLOR = Color.fromHex('#1e2230');
const PANEL_EDGE = Color.fromHex('#0b0d14');
const BUTTON_COLOR = Color.fromHex('#3a4160');
const BUTTON_ACTIVE = Color.fromHex('#3c8d5a');
const BUTTON_WAVE = Color.fromHex('#c0563b');
const OVERLAY_COLOR = Color.fromHex('#000000b0');

const TOWER_HEADS = [Asset.Image.HEAD_ARROW, Asset.Image.HEAD_CANNON, Asset.Image.HEAD_FROST];

function Text(scene: Scene, text: string, fontSize: number, fill = '#ffffff'): TextObject
{
    return scene.AddGameObject(new TextObject(scene, { text, fontSize, fill, fontWeight: 'bold', stroke: '#000000', strokeThickness: 3 }));
}

export class Hud extends Scene
{
    private game!: Game;

    private goldText!: TextObject;
    private livesText!: TextObject;
    private waveText!: TextObject;
    private bestText!: TextObject;
    private messageText!: TextObject;
    private buildButtons: Button[] = [];

    private selectedGroup!: GameObject;
    private selectedTitle!: TextObject;
    private selectedStats!: TextObject;
    private upgradeButton!: Button;
    private sellButton!: Button;

    private waveButton!: Button;
    private speedButton!: Button;

    private gameOverGroup!: GameObject;
    private gameOverText!: TextObject;

    constructor()
    {
        super({ UI: true });
    }

    override OnAwake(game: Game)
    {
        this.game = game;
    }

    override OnStart()
    {
        Text(this, 'TOWER DEFENSE', 28, '#ffd84a').SetPosition(CENTER_X, 30).CenterPivot();

        this.AddGameObject(Asset.Image.ICON_COIN).SetPosition(PANEL_X + 24, 70).CenterPivot();
        this.goldText = Text(this, '', 24, '#ffe14a').SetPosition(PANEL_X + 46, 70).SetPivot(0, 0.5);
        this.AddGameObject(Asset.Image.ICON_HEART).SetPosition(PANEL_X + 180, 70).CenterPivot();
        this.livesText = Text(this, '', 24, '#ff8080').SetPosition(PANEL_X + 202, 70).SetPivot(0, 0.5);

        this.waveText = Text(this, '', 22).SetPosition(PANEL_X + 16, 108).SetPivot(0, 0.5);
        this.bestText = Text(this, '', 16, '#9aa3c0').SetPosition(PANEL_X + PANEL_WIDTH - 16, 108).SetPivot(1, 0.5);

        Text(this, 'BUILD', 16, '#9aa3c0').SetPosition(PANEL_X + 16, 148).SetPivot(0, 0.5);
        this.buildButtons = [];
        TOWER_TYPES.forEach((prefab, i) => {
            const y = 190 + i * 58;
            this.AddGameObject(Asset.Image.TOWER_BASE).SetPosition(PANEL_X + 44, y).CenterPivot().SetScale(0.8);
            this.AddGameObject(TOWER_HEADS[i]).SetPosition(PANEL_X + 44, y).CenterPivot().SetScale(0.8);

            const button = this.AddButton('', BUTTON_COLOR, PANEL_X + 190, y, () => this.game.SelectBuild(prefab), 18, undefined, 210);
            this.buildButtons.push(button);
        });

        this.BuildSelectedPanel();

        this.messageText = Text(this, '', 18, '#ffffff').SetPosition(CENTER_X, 560).CenterPivot();
        this.messageText.alpha = 0;

        this.waveButton = this.AddButton('', BUTTON_WAVE, CENTER_X, 615, () => this.game.waves.StartNext(), 22, undefined, 280);
        this.speedButton = this.AddButton('', BUTTON_COLOR, CENTER_X, 675, () => this.game.ToggleSpeed(), 18, undefined, 280);

        this.BuildGameOver();

        bare.events.on('hudChanged', () => this.Refresh());
        bare.events.on('message', ({ text }) => this.ShowMessage(text));
        this.Refresh();
    }

    private AddButton(text: string, color: Color, x: number, y: number, onPress: () => void, fontSize = 18, parent?: GameObject, minWidth = 0): Button
    {
        const button = new Button(this, { text, fontSize, buttonColor: color.clone(), cornerRadius: 8, margin: 12, minWidth, fontWeight: 'bold' });
        (parent ? parent.AddChild(button) : this.AddGameObject(button)).SetPosition(x, y).CenterPivot();
        button.MakeInteractive(() => {
            if (!this.game.isGameOver)
                onPress();
        }, undefined, 1.05, 0.95, 0.15);
        return button;
    }

    private BuildSelectedPanel()
    {
        this.selectedGroup = this.AddGameObject().SetPosition(PANEL_X, 370);
        this.selectedTitle = this.selectedGroup.AddChild(new TextObject(this, { text: '', fontSize: 22, fill: '#ffffff', fontWeight: 'bold', stroke: '#000000', strokeThickness: 3 }));
        this.selectedTitle.SetPosition(16, 0).SetPivot(0, 0.5);
        this.selectedStats = this.selectedGroup.AddChild(new TextObject(this, { text: '', fontSize: 16, fill: '#c8d0ea', lineHeight: 1.3 }));
        this.selectedStats.SetPosition(16, 22);

        this.upgradeButton = this.AddButton('', BUTTON_ACTIVE, 88, 128, () => this.game.UpgradeSelected(), 16, this.selectedGroup, 150);
        this.sellButton = this.AddButton('', BUTTON_COLOR, 240, 128, () => this.game.SellSelected(), 16, this.selectedGroup, 136);
    }

    private BuildGameOver()
    {
        this.gameOverGroup = this.AddGameObject().SetPosition(bare.width / 2, bare.height / 2);
        this.gameOverGroup.AddChild(new TextObject(this, { text: 'GAME OVER', fontSize: 64, fill: '#ff5040', fontWeight: 'bold', stroke: '#000000', strokeThickness: 6 }))
            .SetPosition(0, -80).CenterPivot();
        this.gameOverText = this.gameOverGroup.AddChild(new TextObject(this, { text: '', fontSize: 24, fill: '#ffffff', align: 'center' }));
        this.gameOverText.SetPosition(0, 0).CenterPivot();

        const restart = new Button(this, { text: 'Play again', fontSize: 28, buttonColor: BUTTON_ACTIVE.clone(), cornerRadius: 10, margin: 16, fontWeight: 'bold' });
        this.gameOverGroup.AddChild(restart).SetPosition(0, 90).CenterPivot();
        restart.MakeInteractive(() => bare.scene.Restart());

        this.gameOverGroup.visible = false;
    }

    private Refresh()
    {
        const game = this.game;

        this.goldText.SetText(String(game.gold));
        this.livesText.SetText(String(game.lives));
        this.waveText.SetText(`Wave ${game.waves.wave}`);
        this.bestText.SetText(`Best: ${SaveData.bestWave}`);

        TOWER_TYPES.forEach((prefab, i) => {
            const data = game.GetTowerData(prefab);
            const button = this.buildButtons[i];
            button.SetText(`[${i + 1}] ${data.displayName}  $${data.cost}`);
            button.buttonColor = (game.buildPrefab == prefab ? BUTTON_ACTIVE : BUTTON_COLOR).clone();
            button.alpha = game.gold >= data.cost ? 1 : 0.45;
        });

        const tower = game.selected;
        this.selectedGroup.visible = !!tower;
        if (tower)
        {
            this.selectedTitle.SetText(`${tower.displayName}  Lv ${tower.level}`);

            const lines = [
                `Damage  ${tower.damage}`,
                `Range  ${Math.round(tower.range)}`,
                `Shots  ${tower.fireRate.toFixed(2)} /s`,
            ];
            if (tower.splash > 0) lines.push(`Splash  ${tower.splash}`);
            if (tower.slow > 0) lines.push(`Slows to ${Math.round(tower.slow * 100)}% for ${tower.slowDuration}s`);
            this.selectedStats.SetText(lines.join('\n'));

            this.upgradeButton.SetText(tower.canUpgrade ? `[U] Upgrade $${tower.upgradeCost}` : 'Max level');
            this.upgradeButton.alpha = tower.canUpgrade && game.gold >= tower.upgradeCost ? 1 : 0.45;
            this.sellButton.SetText(`[X] Sell $${tower.sellValue}`);
        }

        const waveRunning = game.waves.active;
        this.waveButton.SetText(waveRunning ? `Wave ${game.waves.wave} incoming...` : `[Space] Start wave ${game.waves.wave + 1}`);
        this.waveButton.alpha = waveRunning ? 0.5 : 1;
        this.speedButton.SetText(`[F] Speed ${bare.timeScale}x`);

        if (game.isGameOver && !this.gameOverGroup.visible)
        {
            this.gameOverText.SetText(`You reached wave ${game.waves.wave}\nBest: wave ${SaveData.bestWave}`);
            this.gameOverGroup.visible = true;
            this.gameOverGroup.SetScale(0.6);
            TweenTo(this.gameOverGroup, 0.4, { scaleX: 1, scaleY: 1 });
        }
    }

    private ShowMessage(text: string)
    {
        this.messageText.SetText(text);
        this.messageText.alpha = 1;
        TweenTo(this.messageText, 0.5, { alpha: 0, delay: 1.5 });
    }

    override OnPreRender()
    {
        bare.drawRect({ position: new Vec2(PANEL_X, 0), width: PANEL_WIDTH, height: bare.height, color: PANEL_COLOR });
        bare.drawRect({ position: new Vec2(PANEL_X, 0), width: 3, height: bare.height, color: PANEL_EDGE });

        // BELOW THE HUD OBJECTS, SO THE GAME OVER TEXT STAYS ON TOP
        if (this.game.isGameOver)
            bare.drawRect({ position: new Vec2(0, 0), width: bare.width, height: bare.height, color: OVERLAY_COLOR });
    }
}
