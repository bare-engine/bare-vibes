# Castle of the Cyclops King

A metroidvania built on [Bare Engine](https://github.com/bare-engine/bare-engine), combining the
[Platformer](https://github.com/bare-engine/bare-platformer)'s arcade-physics movement with the
[RPG](https://github.com/bare-engine/bare-rpg)'s tiles, combat and connected levels.

52 rooms in 6 areas, 4 ability gates, 6 heart vials, 5 save shrines, a map and a boss.

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrows / WASD |
| Jump (hold for higher, press again in the air with the Sky Elixir) | Z, Space, Up |
| Attack (hold Down / Up to swing down / up, down swings bounce you off enemies) | X, J |
| Dash (after the Gale Elixir) | Shift, C, K |
| Drop through a plank | Down + Jump |
| Map (hold Enter there to warp to the last shrine) | M, Tab |

## Progression

| Ability | Found in | Opens |
| --- | --- | --- |
| Gale Elixir (dash) | The Crypt, below the halls | The spike strip into the Sunken Ruins |
| Sky Elixir (double jump) | Sunken Ruins | The climb up to the Storm Tower, high doors |
| Gecko Ring (wall jump) | Storm Tower | Wall-jump shafts |
| Warhammer | Top of the Storm Tower | Cracked stone: the Sanctum, the Depths and hidden vials |

## How the world is made

- `scripts/buildWorld.cjs` holds the room list, the connections and their gates. It generates
  `public/data/levels/*.json` and `public/data/world.json`. Run `node scripts/buildWorld.cjs`
  after changing it. It overwrites edits made in the level editor.
- A room covers one or more cells of 20 x 12 tiles. Its position on the map is also its position
  in the world, so walking off an edge loads whichever room holds that spot (`src/game.ts`).
- `scripts/makeSprites.py` draws the spikes, cracked block, plank and hearts.

## Development

`npm run dev`, then in the Chrome extension's debug panel: **Give all abilities**, **Reveal map**,
**Defeat boss**. Debug key **0** restarts with cleared save data (**C** is dash in this game).
