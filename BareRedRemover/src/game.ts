import { CanvasScale, Color, StartBare } from 'bare-engine';
import { InitSave } from './save';
import { Menu } from './scenes/menu';

StartBare(Menu, {
    backgroundColor: Color.fromHex('#333333'),
    fixedTimestep: 1 / 60,
    OnInit: InitSave,
    // DEV ONLY: KEEP THE LEVEL EDITOR BUTTON OFF THE LEVEL TITLE
    editorButtonPosition: { x: 0.5, y: 0 },
    resolution: {
        width: 640,
        height: 480,
        scale: CanvasScale.Fit,
    },
});
