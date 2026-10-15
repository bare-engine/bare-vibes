# Bare Vibes

A collection of small games built on [Bare Engine](https://github.com/bare-engine/bare-engine).

Bare is designed to be easy and intuitive for developers, but it's also a good fit for AI coding agents.

**Here every game  was built by an AI agent.** They're here to put the engine to the test: each one leans on a different part of it (physics, tilemaps, rendering at scale, UI, input, save data, audio), and together they show how well an agent can pick up Bare and turn it into something playable.

Click a screenshot to play the built version.

| | |
| :---: | :---: |
| [![BareFactorio](screenshots/factorio.png)](BareFactorio/dist/index.html)<br>**[BareFactorio](BareFactorio/dist/index.html)**<br>A colony and automation sim with colonists, drills and conveyor belts. | [![Bare Vampire Survivors](screenshots/vampiresurvivors.png)](BareVamireSurvivors/dist/index.html)<br>**[Bare Vampire Survivors](BareVamireSurvivors/dist/index.html)**<br>A Vampire Survivors-style game that stress-tests rendering and physics. |
| [![Tower Defense](screenshots/towerdefense.png)](BareTowerDefense/dist/index.html)<br>**[Tower Defense](BareTowerDefense/dist/index.html)**<br>Build archer, cannon and frost towers to hold off the waves. | [![BareRace](screenshots/race.png)](BareRace/dist/index.html)<br>**[BareRace](BareRace/dist/index.html)**<br>A top-down racer against four AI drivers. |
| [![Tetris](screenshots/tetris.png)](BareTetris/dist/index.html)<br>**[Tetris](BareTetris/dist/index.html)**<br>Tetris with hold, next queue and hard drop. | [![BareGolf](screenshots/golf.png)](BareGolf/dist/index.html)<br>**[BareGolf](BareGolf/dist/index.html)**<br>Six holes of drag-and-shoot mini golf. |
| [![Castle of the Cyclops King](screenshots/metroidvania.png)](BareMetroidvania/dist/index.html)<br>**[Castle of the Cyclops King](BareMetroidvania/dist/index.html)**<br>A metroidvania: 52 rooms, ability gates, a map and a boss. | [![Sigil Quest](screenshots/zelda.png)](BareZelda/dist/index.html)<br>**[Sigil Quest](BareZelda/dist/index.html)**<br>A top-down action RPG in the style of early Zelda, with five dungeons. |
| [![Red Remover](screenshots/redremover.png)](BareRedRemover/dist/index.html)<br>**[Red Remover](BareRedRemover/dist/index.html)**<br>A physics puzzler remake of the Flash game: remove the red shapes, keep the green. | [![Flipside](screenshots/jumper.png)](BareJumper/dist/index.html)<br>**[Flipside](BareJumper/dist/index.html)**<br>A one-button gravity-flip runner with ghost replays of your best run. |
| [![Sokoban](screenshots/sokoban.png)](BareSokoban/dist/index.html)<br>**[Sokoban](BareSokoban/dist/index.html)**<br>Box-pushing puzzles with undo. | [![BareSnake](screenshots/snake.png)](BareSnake/dist/index.html)<br>**[BareSnake](BareSnake/dist/index.html)**<br>Snake, with a smooth bendy body. |

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
