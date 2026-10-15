import { CanvasPosition, CanvasScale, Color, StartBare, TextureFilterMode } from 'bare-engine';
import { RegisterSounds } from './game/sfx';
import { SetSaveDefaults } from './game/state';
import { Title } from './scenes/title';

StartBare(Title, {
    backgroundColor: new Color(14, 14, 22, 255),
    antiAlias: false,
    textureFilter: TextureFilterMode.NEAREST,
    roundPixels: true,
    resolution: {
        width: 320,
        height: 180,
        scale: CanvasScale.Fit,
        position: CanvasPosition.Center,
    },
    OnInit: () => {
        SetSaveDefaults();
        bare.storage.Load();
        RegisterSounds();
    },
});
