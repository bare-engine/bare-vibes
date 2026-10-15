# AGENTS.md

A browser game built on [Bare Engine](https://github.com/bare-engine/bare-engine): TypeScript, Vite, WebGL.

## Engine docs

The engine docs ship with the package. Read the page for your task before writing engine code. Don't guess the API.

- Docs: `node_modules/bare-engine/docs/` (`guide/` explains tasks, `reference/` lists the API)
- Source: `node_modules/bare-engine/src/`, the final answer when the docs are unclear
- Online: https://bare-engine.github.io/bare-engine/

Links inside the docs leave out `.md`: `./components` means `components.md` in the same folder.

| Task | Read |
| --- | --- |
| Where files go | `guide/project-structure.md` |
| Scenes, `StartBare` options | `guide/scenes.md`, `reference/configuration.md`, `reference/scene-manager.md` |
| GameObjects, finding and ordering them | `guide/game-objects.md`, `guide/custom-game-objects.md`, `reference/objects.md` |
| Behavior / scripts | `guide/components.md`, `guide/lifecycle.md`, `reference/ecs.md` |
| Prefabs, presets, `settingsData.json` | `guide/prefabs.md`, `guide/settings-data.md` |
| Levels and layers | `guide/levels-and-layers.md`, `guide/level-editor.md`, `reference/level.md` |
| Images, atlas, loading | `guide/assets.md`, `reference/assets.md` |
| Animations, particles, tweens | `guide/animations.md`, `guide/particles.md`, `reference/tweens.md` |
| Shaders, masks, shapes | `guide/rendering.md` |
| Tile maps: ground, walls, grids of tiles | `guide/tilemaps.md` |
| Text and UI | `guide/text-and-ui.md` |
| Input, mobile | `reference/input.md`, `guide/mobile.md` |
| Physics | `reference/physics.md` |
| Camera | `reference/camera.md` |
| Sound | `reference/sound.md` |
| Events | `guide/events.md` |
| Saving | `reference/save-data.md` |
| Screen size, pixel art | `guide/resolution.md` |
| `bare` global, other globals, math | `reference/bare.md`, `reference/globals.md`, `reference/math.md` |
| Inspector / serialization decorators | `reference/inspector-decorators.md` |
| Build, `bareEngine` options in package.json | `guide/building-and-publishing.md`, `reference/package-json.md` |
| Something broken | `guide/troubleshooting.md`, `guide/debugging.md` |
| Running the game in a headless browser, screenshots | `guide/debugging.md` (Testing in a headless browser) |

## Commands

| Command | Use |
| --- | --- |
| `npm run dev` | Dev server with hot reload. Also generates `src/generated/assets.ts` and packs the texture atlas. |
| `npx tsc` | Type-check (strict, no emit). Run after every code change. |
| `npm run build` | Production build to `dist/`. |
| `npm run build-zip` | Build and zip to `dist.zip`. |
| `npm run analyze` | Build and open a bundle size map. |
| `npm run build:assets` | Pack the texture atlas and generate `src/generated/assets.ts` without the dev server. Run it before `npx tsc` after adding images or prefabs while the dev server is off. |
| `npm run update-engine` | Move to the newest engine release allowed by `package.json`. Updates `package-lock.json`. |

On PowerShell setups that block `npm.ps1`, use `npm.cmd`.

## Project layout

- `src/game.ts`: entry point; calls `StartBare(Game)`
- `src/components/`: components; exported `Component` classes are registered automatically
- `public/data/settingsData.json`: prefabs, base prefabs, presets, animations, layers, settings
- `public/data/levels/`: level JSON files
- `texturePackImages/`: small images, packed into an atlas
- `public/initial/`: loaded before the game starts
- `public/images/`, `public/sounds/`, `public/fonts/`: loaded on first use, by name
- `package.json` → `bareEngine`: engine build settings

## Rules

- Don't edit generated files: `src/generated/`, `public/initial/generated/`, `dist/`.
- Don't edit `node_modules/bare-engine`. Engine changes belong in the engine repo.
- `bare` is a global. Don't import it.
- TypeScript is `strict`. Use `override` on lifecycle methods (`OnStart`, `OnFixedUpdate`, …).
- Put behavior in components, and data in prefabs in `settingsData.json`. Only write a custom GameObject subclass when `guide/custom-game-objects.md` says it fits.
- Use names from `src/generated/assets.ts` (`Asset.Image.X`, `Data.Prefab.X`) instead of string literals when they exist.
- Production builds strip code, decorators and asset lists. If something works in dev but not in the build, read `reference/package-json.md`.
