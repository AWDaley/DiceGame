# Jarbound — Dice-Building Roguelike (Prototype)

A playable browser prototype of a *Slay the Spire*-inspired dice-building roguelike, where you select dice for a jar, roll them, attach modifiers to other dice, spend mana to manipulate their faces, and manage cooldowns across combat turns.

**Working title:** Jarbound. **Status:** Playable, single-player vertical slice with four encounters. **Platform:** Browser (desktop and mobile). **Runtime dependencies:** None.

## Run locally

Requires Node.js 20+ for the included development server and test runner.

```bash
npm run dev
# Open http://localhost:5173
```

Or serve the repository root with any static HTTP server, for example:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Because the app uses ES modules, **do not double-click `index.html`** and expect it to work from a `file://` URL: serve the files over HTTP instead. No npm installation or build step is required.

## How to play

1. **Choose** 1–5 available dice, including at least one non-modifier die. Click/tap inventory dice to add them to the jar.
2. **Roll** the jar. Each die has a fixed job (attack, defend, poison, weaken, buff, heal, restore mana, add, or multiply). Its rolled number determines that effect's magnitude.
3. **Manipulate** a rolled die using mana: reroll for **1 mana**, or increase the result by 1 for **2 mana** (up to the die's highest face). Mana starts at 5 and regenerates 2 per turn, up to 5.
4. **Attach** purple modifier dice to any effect die after rolling. Click/tap the modifier, then the target; drag-and-drop also works on desktop. Adding and attaching costs no mana. Every rolled modifier must have a target before you can commit.
5. **Reorder** effect dice to control when buffs, attacks, heals, blocks, and debuffs activate. Modifiers activate with their target; additive effects apply before multipliers.
6. **Commit** your cast. Dice resolve in order, the enemy performs its telegraphed action, then used dice enter cooldown. Each die's cooldown number is how many *future* turns it must skip.
7. **Progress** through four fights. After each victory, choose a free die, rest, or forge one face. Spend earned gold in the merchant's shop to acquire dice, improve individual faces, or heal.

### Example attachment

An Attack die rolls **4**, an Add die rolls **3**, and a Multiply die rolls **4** (which becomes ×2). Attach both modifiers to Attack:

`(4 + 3) × 2 = 14 damage`

The same two modifiers could instead be attached to a Block die, a Poison die, or a mana-generation die. Ordinary modifiers can target one effect die each; you can stack multiple modifiers onto one target. Modifier-to-modifier chaining is not part of the initial prototype.

### Design decisions for the first build

| Rule | Prototype choice |
|---|---|
| Die shapes | All six-sided (d6) |
| Roles | One job per die; face value determines magnitude |
| Jar size | 5 dice |
| Modifiers | Additive and multiplicative, attach after rolling |
| Manipulations | Reroll (1 mana), +1 nudge (2 mana) |
| Cooldowns | Per-die, 0–2 skipped turns |
| Enemies | 4 encounters with telegraphed attack/block/poison moves |
| Progression | Reward dice, a shop, face-by-face upgrades, healing |

This is deliberately a combat and progression **prototype**, not a content-complete roguelike. It does not yet include random routes, artifacts/jar variants, multiple die shapes, sound, long-term save files, or full balance tuning.

## Code layout

```text
index.html              Main HTML and help dialog
styles.css              Responsive game presentation
src/content.js          Die definitions, enemy moves, starting loadout, balance constants
src/game.js             Pure game reducer, combat rules, progression logic
src/main.js             Browser UI rendering and pointer interactions
scripts/server.js       Minimal zero-dependency development HTTP server
tests/game.test.js      Deterministic Node.js unit tests
.github/workflows/ci.yml CI and GitHub Pages deployment
```

The combat rules are pure and deterministic if the caller passes an RNG to `reduceGame(state, action, rng)`. State transitions return a fresh state, which makes mechanics easy to test and extend.

## Test

```bash
npm run check   # syntax checks + unit tests
npm test        # node:test suite only
```

## Deploy to GitHub Pages

The included GitHub Actions workflow runs the Node.js tests, then publishes the static site from the repository root when code is pushed to `main`.

To activate deployment for the first time, go to the GitHub repository **Settings → Pages → Build and deployment → Source → GitHub Actions**. Once the workflow completes, your site can be visited at the Pages URL shown in the repository's Pages settings. The workflow may require Pages to be enabled in repository settings and Actions permission granted by the repository owner.

For any other static host, upload `index.html`, `styles.css`, and `src/` without changing the directory layout.

## Next iteration candidates

- Multiple die sizes, probability-shaping upgrades, and die-specific faces.
- Jar equipment, passive relics, alternate player classes, and more enemy patterns.
- Recollection from cooldown as a high-cost mana action, and advanced modifier chaining.
- A branching map, shop tuning, persistence, animations, accessibility enhancements, and audio feedback.
- Automated browser regression tests and telemetry-free local balancing tools.

## License

MIT (see `LICENSE`).