# Bare Trust

A simplified port of [The Evolution of Trust](https://ncase.me/trust/) by Nicky Case, built with [Bare Engine](https://github.com/BareEngine/BareEngine).

Pick **Cooperate** or **Cheat** against a random opponent and watch the outcome play out at the coin machine.

## Showcases

- **Prefabs** – the payoff diagram and buttons are defined in `settingsData.json`
- **Buttons** – prefab-based buttons with click handlers
- **Custom GameObject subclasses** – `Peep` builds its own hierarchy and animates in `OnUpdate`
- **Tweens** – promise-based tweens with easing, chained with `async`/`await`
- **UI** – score display on a separate UI scene

## Getting started

```bash
npm install
npm run dev
```