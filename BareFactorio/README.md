# BareFactorio

A cozy colony and automation sim on [Bare Engine](https://github.com/bare-engine/bare-engine): a Factorio-lite / Oxygen Not Included-lite. Mark trees and ore for your colonists to harvest, plan buildings they'll construct, and automate with drills and conveyor belts. Keep everyone fed with berry farms, and build huts so newcomers can move in.

It also serves as a stress test of how far Bare scales.

## Running

```sh
npm install
npm run dev
```

| URL parameter | Effect |
| --- | --- |
| `?size=512` | World size in tiles, 64 to 2048 (default 256) |
| `?seed=7` | A fixed world seed |
| `?new` | Ignore the save and start fresh |
| `?stress` | Start with the stress test: belt loops full of items, 150 more colonists, nearby trees marked |
| `?test` | Keep running without focus, for headless browsers |

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows, right or middle drag | Move the camera |
| Wheel | Zoom |
| 1–3 | Select, Harvest (drag over trees, boulders, ore, bushes; Shift-drag to unmark), Remove |
| 4–0, - | Buildings: Conveyor (drag to lay a line), Crate, Sawmill, Smelter, Drill, Berry farm, Hut, Workshop |
| R / Shift+R | Rotate |
| Space | Pause |
| Right click, Esc | Back to Select |

The top-right panel shows sim and render timings. It also has speed, save/load (autosave every 2 minutes) and a **Stress** button.

## Layout

- `src/sim/`: the simulation, with no engine imports.
  - `world.ts`: typed-array tile layers and world generation.
  - `colony.ts`: buildings, belts, item flow, job search, colony growth.
  - `worker.ts`: the colonist job state machine.
  - `pathfinding.ts`: A*, walkable areas, flow field.
  - `save.ts`: binary, gzipped saves.
  - `goals.ts`: the goal list.
  - `stress.ts`: the stress test setup.
- `src/render/`: the ground as engine tile maps, and immediate drawing of buildings, belts and items.
- `src/components/workerViewComponent.ts`: draws a colonist between sim ticks.
- `src/game.ts`: the game scene. Runs the 20 tps sim in `OnFixedUpdate`, handles drawing and save/load.
- `src/controls.ts`, `src/hud.ts`: input and the UI scene.
- `public/data/settingsData.json`: building prefabs, with costs and recipes in `customData`, and the worker prefab.

## Scripts

| Command | Use |
| --- | --- |
| `npm run sprites` | Regenerate the pixel art in `texturePackImages/` |
| `npm run sim-bench` | Run the sim in Node: a scripted playthrough of all goals, then stress benchmarks at 256², 512² and 1024² |
| `npx tsc` | Type-check |
| `npm run build` | Production build |
