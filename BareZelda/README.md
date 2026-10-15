# Sigil Quest

A top-down action RPG in the style of the early Zelda games, built on [Bare Engine](https://github.com/bare-engine/bare-engine).

Explore the overworld around the village of Elmore, clear five dungeons, and collect the five sigils to defeat the Dark Lord.

## Running it

```sh
npm install
npm run dev
```

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Space / J | Swing the sword, talk, open chests |
| K / X | Use the item on the item button |
| Q / E | Switch item |
| Enter / I | Open the bag: items, quests, sigils |

Development keys: F1 debug drawing, F2 pause, F4 restart with a cleared save.

## What's in it

- An overworld of 64×48 tiles with a village, a forest, a lake, ashen lands and the castle.
- Five dungeons, each with small keys, a big key, an item, puzzles and a boss:
  1. **Forest Temple**: Bow, King Slime
  2. **Stone Cavern**: Bombs, Stone Golem
  3. **Lake Shrine**: Flippers, Lake Serpent
  4. **Ember Fortress**: Fire Rod, Flame Knight
  5. **Dark Castle**: The Dark Lord
- Each item opens the way on the overworld: shoot the stone eye, bomb the cracked rocks, swim the river, burn the thorns. Four sigils break the castle seal.
- Quests: the main quest, Mina's lost cat, Bram's slime trouble, and Old Tom's ring. A shop sells potions, arrows and bombs.
- Saving is automatic, each time you go through a door.

## Generated content

The art, maps and sounds are made by scripts in `tools/`, so they can be changed in code:

| Command | Writes |
| --- | --- |
| `npm run build:art` | Sprites in `texturePackImages/`, from ASCII pixel art and shapes in `tools/art.cjs` |
| `npm run build:maps` | `public/data/levels/*.json` and the baked ground images in `public/images/maps/`. The overworld and the dungeon rooms are in `tools/maps.cjs`, the tile painters in `tools/tiles.cjs` |
| `npm run build:sfx` | Sound effects and music loops as `.wav` in `public/sounds/` |

`build:maps` overwrites the level files, so edits made in the level editor are lost. Change `tools/maps.cjs` instead.

## Code

- `src/scenes/`: `Title`, `World` (levels, player, camera, puzzles), `HUD` (hearts, dialogue, bag), `Ending`
- `src/components/`: player, enemies, bosses, projectiles, bombs, pickups, chests, doors, gates, switches, torches, breakables, NPCs, warps
- `src/game/`: save data and inventory (`state.ts`), items, quests, NPC dialogue, effects and sounds
- `public/data/settingsData.json`: prefabs and animations
