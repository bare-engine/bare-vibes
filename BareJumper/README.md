# Flipside

A one-button gravity-flip runner built on Bare Engine. You run on your own; press **Space / arrows / click / tap** to flip gravity between the floor and the ceiling. Dodge the spikes and pits, grab orbs, and race the ghost of your best run.

- `src/components/runnerComponent.ts`: running, flipping (hand-rolled gravity), death and finish
- `src/components/orbComponent.ts`: collectables
- `src/scenes/runScene.ts`: level flow, camera follow, parallax stars, effects, ghost replay
- `src/scenes/menuScene.ts`, `src/hud.ts`: menu with unlocks and best times, in-game HUD
- `src/progress.ts`: save data (best times, orbs, ghosts, unlocks)
- `tools/buildLevels.cjs`: builds `public/data/levels/*.json` from the level definitions (`node tools/buildLevels.cjs --print`)
- `tools/checkLevels.cjs`: checks every level can be finished and how tight each flip is (`node tools/checkLevels.cjs`)

Note that `buildLevels.cjs` overwrites the level files, so edits made in the level editor are lost when you rerun it.

---

<h1>Bare Template</h1>
The starting point for a new project using the <a href="https://github.com/bare-engine/bare-engine">Bare Engine</a>.

<br>
<br>

<h2>Getting Started</h2>

Install <a href="https://nodejs.org/en/download">Node</a> and <a href="https://git-scm.com/download/win">Git</a><br><br>
<ol>
    <li>Click Code->"Download ZIP" - unzip</li>
    <li>Open the command line in the unzipped folder</li>
    <li>Run <code>npm install</code> + <code>npm run dev</code></li>
    <li>Ctrl-click the localhost URL shown in the command line.</li>
</ol>
<br>Or:<br>
<ol>
    <li>Click "Use this template" in the top right - create the repo.</li>
    <li><pre><code>git clone https://github.com/PATH-TO-YOUR-REPO.git bare-game
cd bare-game
npm install
npm run dev</code></pre></li>
    <li>Ctrl-click the localhost URL shown in the command line.</li>
</ol>

🚧 Note: The engine is still in active development, some features may be unstable 🚧
<br><br>

<h2>Getting Going</h2>
<ol>
    <li><a href="https://bare-engine.github.io/bare-engine/">Documentation</a> - Learn how everything works, starting with the <a href="https://bare-engine.github.io/bare-engine/guide/project-structure">project structure</a></li>
    <li><a href="https://chromewebstore.google.com/detail/bare-engine/dbohigkcdpdnchgaffmofeoffnpkmphb">Chrome Extension</a> - Get the extension</li>
    <li><a href="https://github.com/bare-engine/bare-showcase">Bare Showcase</a> - Explore the engine's features</li>
    <li><a href="https://github.com/bare-engine/bare-demos">Bare Demos</a> - Explore game examples</li>
</ol>
<br>

Questions or bug reports? Join the <a href="https://discord.gg/zq3Qh45JE">Discord</a>.
