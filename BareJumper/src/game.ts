import { CanvasScale, Color, StartBare } from 'bare-engine';
import { MenuScene } from './scenes/menuScene';

StartBare(MenuScene, {
    backgroundColor: Color.fromHex('#10122a'),
    // KEEP THE DEV-ONLY LEVEL EDITOR BUTTON AWAY FROM THE HUD
    editorButtonPosition: { x: 0.5, y: 0 },
    resolution: {
        width: 1280,
        height: 720,
        scale: CanvasScale.Fit,
    },
});
