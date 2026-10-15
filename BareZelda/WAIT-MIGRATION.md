# Scene-wait migration

Scanned 33 projects with a bare-engine dependency under the JS folder. Migrated 73 global wait/cancellation calls across 37 source files in 13 projects. The final AST audit covered 851 source files and found no remaining live global wait calls. BareRPG and BareZelda were already migrated.

Waits now belong to their scene and cancellation is checked before continuing gameplay work. Cleanup handles weapon hitboxes, player stun/control locks, collision listeners, possession flags, benchmark settings and Memory's tap listener. Memory and Trust propagate cancellation through their parent sequences. GMTK polling loops use WaitRealTime while their scene is paused.

| Project | Type-check | Build | Production startup |
| --- | --- | --- | --- |
| BareDemosCollection/bare-platformer | Passed | Passed | Passed |
| BareDemosCollection/bare-rpg | Existing legacy errors | Existing missing engine import | Blocked by build |
| BareDemosCollection/bare-shmup | Existing legacy errors | Passed | Existing API error |
| BareJumper | Passed | Passed | Passed |
| BareMemory | Passed | Passed | Passed |
| BareMetroidvania | Passed | Passed | Passed |
| BarePlatformer | Passed | Passed | Passed |
| BareShmup | Passed | Passed | Passed |
| BareTrust | Passed | Passed | Passed |
| BareVamireSurvivors | Passed | Passed | Passed |
| emojiWorld | Existing legacy errors | Passed | Existing API error |
| GMTK2026 | Passed | Passed | Passed |
| PrisonersDilemma | Passed | Passed | Passed |

Focused production checks passed for Memory (cancelled tap race cleanup and completion propagation), Survivors (cancelled benchmark settings restoration), and GMTK (paused polling, resume and cancellation). Startup checks use headless Chrome and a local Poki SDK stub; they are not full gameplay tests.

Remaining validation blockers:

- BareDemosCollection/bare-rpg: existing missing relative engine imports, missing override modifiers and older API names. Build fails on ../../../BareEngine/src/types/bareTypes.
- BareDemosCollection/bare-shmup: existing Data.Entity/Bare.assets.entities calls incompatible with the regenerated asset lists; startup fails reading SHIP.
- emojiWorld: existing engine API mismatches (65 non-wait TypeScript diagnostics also present before migration); startup fails because camera.SetBoundsToScreen is absent.

PrisonersDilemma was the only affected project still on an engine without scene waits. Installed the updated sibling engine locally with npm --no-save --package-lock=false; its dependency manifest and lockfile were preserved. Other affected projects already had the new API. Reinstallations must use an engine containing the scene-wait API. Build-generated gameId additions in the archived demo manifests were removed.

Projects with no remaining global wait calls before this pass:

- BareArcadePhysics
- BareAtlasRotation
- BareBenchmarks
- BareDemos
- BareFactorio
- BareGolf
- BareMonopoly
- BareRedRemover
- BareResolutionDemo
- BareRPG
- BareSnake
- BareSokoban
- BareTemplate
- BareTest
- BareTetris
- BareTowerDefense
- BareWaldo
- BareWebsterado
- BareZelda
- PokiGameJam/HideAndSeek

Changed files:

- BareDemosCollection/bare-platformer/src/game.ts
- BareDemosCollection/bare-rpg/src/gameOver.ts
- BareDemosCollection/bare-rpg/src/game.ts
- BareDemosCollection/bare-rpg/src/components/aliveComponent.ts
- BareDemosCollection/bare-rpg/src/components/enemyAIComponent.ts
- BareDemosCollection/bare-rpg/src/objects/weapon.ts
- BareDemosCollection/bare-rpg/src/components/playerComponents.ts
- BareDemosCollection/bare-shmup/src/game.ts
- BareDemosCollection/bare-shmup/src/components/aliveComponent.ts
- BareJumper/src/components/orbComponent.ts
- BareJumper/src/scenes/runScene.ts
- BareMemory/src/game.ts
- BareMemory/src/menu.ts
- BareMetroidvania/src/game.ts
- BareMetroidvania/src/components/crackedComponent.ts
- BareMetroidvania/src/components/playerComponent.ts
- BareMetroidvania/src/components/enemyComponent.ts
- BareMetroidvania/src/ui/hud.ts
- BarePlatformer/src/game.ts
- BareShmup/src/game.ts
- BareShmup/src/components/aliveComponent.ts
- BareTrust/src/peep.ts
- BareVamireSurvivors/src/systems/benchmark.ts
- emojiWorld/src/controllers/movementController.ts
- emojiWorld/src/components/aliveComponent.ts
- emojiWorld/src/components/goalComponent.ts
- emojiWorld/src/components/pickupComponent.ts
- emojiWorld/src/components/enemyAIComponent.ts
- emojiWorld/src/components/playerComponent.ts
- emojiWorld/src/scenes/mapScene.ts
- GMTK2026/src/game.ts
- GMTK2026/src/scenes/uiScene.ts
- GMTK2026/src/scenes/goalsScene.ts
- GMTK2026/src/handlers/introSequence.ts
- PrisonersDilemma/src/peep.ts
- BareTrust/src/game.ts
- PrisonersDilemma/src/game.ts
