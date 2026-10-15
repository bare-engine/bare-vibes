# Bare Vibes

A collection of small games built on [Bare Engine](https://github.com/bare-engine/bare-engine).

Bare is designed to be easy and intuitive for developers, but it's also a good fit for AI coding agents.

**Here every game  was built by an AI agent.** They're here to put the engine to the test: each one leans on a different part of it (physics, tilemaps, rendering at scale, UI, input, save data, audio), and together they show how well an agent can pick up Bare and turn it into something playable.

Click a screenshot to play the built version.

| | |
| :---: | :---: |
| [![BareFactorio](screenshots/factorio.png)](https://bare-engine.github.io/bare-vibes/BareFactorio/dist/)<br>**[BareFactorio](https://bare-engine.github.io/bare-vibes/BareFactorio/dist/)**<br>A colony and automation sim with colonists, drills and conveyor belts. | [![Bare Vampire Survivors](screenshots/vampiresurvivors.png)](https://bare-engine.github.io/bare-vibes/BareVamireSurvivors/dist/)<br>**[Bare Vampire Survivors](https://bare-engine.github.io/bare-vibes/BareVamireSurvivors/dist/)**<br>A Vampire Survivors-style game that stress-tests rendering and physics. |
| [![Tower Defense](screenshots/towerdefense.png)](https://bare-engine.github.io/bare-vibes/BareTowerDefense/dist/)<br>**[Tower Defense](https://bare-engine.github.io/bare-vibes/BareTowerDefense/dist/)**<br>Build archer, cannon and frost towers to hold off the waves. | [![BareRace](screenshots/race.png)](https://bare-engine.github.io/bare-vibes/BareRace/dist/)<br>**[BareRace](https://bare-engine.github.io/bare-vibes/BareRace/dist/)**<br>A top-down racer against four AI drivers. |
| [![Tetris](screenshots/tetris.png)](https://bare-engine.github.io/bare-vibes/BareTetris/dist/)<br>**[Tetris](https://bare-engine.github.io/bare-vibes/BareTetris/dist/)**<br>Tetris with hold, next queue and hard drop. | [![BareGolf](screenshots/golf.png)](https://bare-engine.github.io/bare-vibes/BareGolf/dist/)<br>**[BareGolf](https://bare-engine.github.io/bare-vibes/BareGolf/dist/)**<br>Six holes of drag-and-shoot mini golf. |
| [![Castle of the Cyclops King](screenshots/metroidvania.png)](https://bare-engine.github.io/bare-vibes/BareMetroidvania/dist/)<br>**[Castle of the Cyclops King](https://bare-engine.github.io/bare-vibes/BareMetroidvania/dist/)**<br>A metroidvania: 52 rooms, ability gates, a map and a boss. | [![Sigil Quest](screenshots/zelda.png)](https://bare-engine.github.io/bare-vibes/BareZelda/dist/)<br>**[Sigil Quest](https://bare-engine.github.io/bare-vibes/BareZelda/dist/)**<br>A top-down action RPG in the style of early Zelda, with five dungeons. |
| [![Red Remover](screenshots/redremover.png)](https://bare-engine.github.io/bare-vibes/BareRedRemover/dist/)<br>**[Red Remover](https://bare-engine.github.io/bare-vibes/BareRedRemover/dist/)**<br>A physics puzzler remake of the Flash game: remove the red shapes, keep the green. | [![Flipside](screenshots/jumper.png)](https://bare-engine.github.io/bare-vibes/BareJumper/dist/)<br>**[Flipside](https://bare-engine.github.io/bare-vibes/BareJumper/dist/)**<br>A one-button gravity-flip runner with ghost replays of your best run. |
| [![Sokoban](screenshots/sokoban.png)](https://bare-engine.github.io/bare-vibes/BareSokoban/dist/)<br>**[Sokoban](https://bare-engine.github.io/bare-vibes/BareSokoban/dist/)**<br>Box-pushing puzzles with undo. | [![BareSnake](screenshots/snake.png)](https://bare-engine.github.io/bare-vibes/BareSnake/dist/)<br>**[BareSnake](https://bare-engine.github.io/bare-vibes/BareSnake/dist/)**<br>Snake, with a smooth bendy body. |

## Running locally

The `dist` builds load their data with `fetch`, so open them through a web server instead of straight from disk. From this folder:

```sh
npx serve .
```

Then go to e.g. `http://localhost:3000/BareZelda/dist/`.

To work on a game, go into its folder and run:

```sh
npm install
npm run dev
```
