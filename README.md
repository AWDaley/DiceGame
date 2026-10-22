# Jarbound — Dice-Building Roguelike (Prototype)

A playable browser prototype of a *Slay the Spire*-inspired dice-building roguelike, where you select dice for a jar, roll them, attach modifiers to other dice, spend mana to manipulate their faces, manage mana and cooldowns across combat turns, and adapt to enemy armor and interruptible attacks.

**Working title:** Jarbound. **Status:** Playable combat overhaul (v0.2), four encounters. **Platform:** Browser (desktop and mobile). **Runtime dependencies:** None.

## Play from the ZIP — no installation needed

1. Download the latest release ZIP (or the updated folder from this repository).
2. **Extract all files** to a folder.
3. Open **`DiceGame/index.html`** in Chrome, Firefox, or Edge. The game appears immediately; click a die in **The dice satchel** to add it to the jar, then choose **ROLL THE JAR**.

`index.html` is a self-contained, offline HTML game: JavaScript and styles are embedded and do not depend on `file://`-restricted module loading, a web server, or an internet connection. **Do not use the older `Jarbound-combat-overhaul-v02.zip`: that version cannot run when opened directly as a local file.**

### Development

Node.js 20+ is required only for editing, rebuilding, and running tests—not for playing the downloaded game.

```bash
npm run dev       # Builds the standalone file and starts a local server
# Open http://localhost:5173
npm run build     # Regenerate the offline-playable index.html after changing src/ or styles.css
npm run check     # Check the generated file, run syntax checks and tests
```

`src/` retains normal ES modules for development and unit testing. `src/index.template.html` is the editable page shell. `scripts/build-standalone.js` regenerates `index.html`, bundling the game into one file without installing dependencies. Do not manually edit the generated `index.html` because the next build will replace it.

## How to play

1. **Choose** 1–5 available dice, including at least one non-modifier die. Every die has a displayed **mana cost**. Preparing the jar reserves a budget without spending it; mana is deducted when you roll. A zero-cost Quick Cut stays available on zero cooldown.
2. **Roll** the jar. Each die has a fixed job (attack, defend, poison, weaken, buff, heal, restore mana, add, or multiply). Its rolled number determines that effect's magnitude.
3. **Manipulate** results using **one free Recollection (reroll) per turn**, further rerolls for **1 mana** each, or +1 nudges for **2 mana**. Mana starts at 7, regenerates 4 after a turn, and carries over up to 7. This is the same mana used to load the jar.
4. **Attach** purple modifier dice to any effect die after rolling. Click/tap the modifier, then the target; drag-and-drop also works on desktop. Adding and attaching costs no mana. Every rolled modifier must have a target before you can commit.
5. **Reorder** effect dice to control when buffs, attacks, heals, blocks, and debuffs activate. Modifiers activate with their target; additive effects apply before multipliers.
6. **Commit** your cast. Dice resolve in order, the enemy performs its telegraphed action, then used dice enter cooldown. Each die's cooldown number is how many *future* turns it must skip.
7. **Counter enemies.** The Hollow Sentinel has permanent armor that reduces **every physical hit**, which Platebreaker removes; poison bypasses armor. The Scrap Brute and Jarbreaker have **interruptible charged attacks**—apply stagger with Disruptor to reach the visible threshold *on that turn*. Stagger is cleared after each enemy action.
8. **Progress** through four fights. After each victory, choose a free die, rest, or forge one face. Spend earned gold in the merchant's shop to acquire dice, improve individual faces, or heal.

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
| Mana | Each die has a roll cost; 7 maximum, +4/turn, 1 free reroll/turn |
| Enemy counters | Per-hit armor, permanent sunder, charged moves and stagger interrupts |
| Manipulations | Reroll (1 mana), +1 nudge (2 mana) |
| Cooldowns | Per-die, 0–2 skipped turns |
| Enemies | 4 encounters with telegraphed attacks, defensive moves, poison, armor, and charged moves |
| Progression | Reward dice, a shop, face-by-face upgrades, healing |

This is deliberately a combat and progression **prototype**, not a content-complete roguelike. It does not yet include random routes, artifacts/jar variants, multiple die shapes, sound, long-term save files, or full balance tuning.

## Combat-overhaul design notes (v0.2)

- **One resource, two uses.** Loading dice into the jar costs mana when you roll; remaining mana can be used to repair a poor roll. A free Recollection retains post-roll player agency even after spending all available mana on dice.
- **Never hard-lock the player.** Quick Cut is a free, zero-cooldown attack die, so even at zero mana the next turn can still be played. Mana Well is also free, but has cooldown and restores mana only when the cast resolves, not in the manipulation phase.
- **Armor is not block.** Armor reduces each direct attack *before* ordinary shield block, remains for the whole encounter until sundered, and does not reduce poison damage. Prioritizing Platebreaker before Strike is now a real sequencing choice.
- **Interrupts reward timing.** Charged attacks show a stagger threshold. Stagger must reach that threshold on the same turn; it cannot be banked. Interrupting skips the charged enemy move entirely, but other attacks are still countered by defending, weakening, or killing the enemy.
- **For testing rather than final balance.** Costs, regeneration, stagger thresholds, and enemy defenses are data-driven. The existing die types still use d6 faces; adding damage types, active abilities, and more enemy archetypes remains future work.

## Code layout

```text
index.html              Generated standalone offline game (open directly to play)
styles.css              Editable responsive styles
src/index.template.html  Editable page shell
scripts/build-standalone.js Zero-dependency offline exporter
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
- Active character abilities (e.g. Recall from cooldown / Overcharge), elemental damage types, and advanced modifier chaining.
- A branching map, shop tuning, persistence, animations, accessibility enhancements, and audio feedback.
- Automated browser regression tests and telemetry-free local balancing tools.

## License

MIT (see `LICENSE`).
