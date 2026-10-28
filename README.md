# Jarbound — Character Stats Prototype v0.3

An offline, single-player dice-building roguelike with four encounters. Choose a character build, load a five-die jar, roll, attach modifiers, manipulate outcomes, and manage mana and cooldowns.

## Play immediately

**Double-click `index.html`.** It contains all game code and styles; no installation, account, server, network, or build step is needed for players. Extract the ZIP first. New Run returns to character creation.

There is no save system yet. Refreshing the page or starting a new run discards the current run.

## Build a character

Start with **3 attribute points**, allocating at most **2** to one attribute. Each non-final victory grants **1 additional point**, up to **4** per attribute. Allocate the earned point before choosing the normal victory reward. Points can be moved only during the current allocation screen; established investments cannot be refunded.

Every die has exactly one associated attribute, shown on its card. The association belongs to the die, not its effect family: Stone Guard uses Vitality, Duelist Parry uses Finesse, and Arcane Barrier uses Arcana, although all three generate block.

| Attribute | Examples | Character effect |
|---|---|---|
| Might | Iron Strike, Platebreaker, Disruptor | Add to the associated die's roll |
| Finesse | Quick Cut, Venom, Gilded Plus, Duelist Parry | Add to the associated die's roll |
| Arcana | Hex, Echo Prism, Black Spores, Arcane Barrier | Add to the associated die's roll |
| Vitality | Guard, Restoration, Iron Bastion | +6 maximum and current HP per permanent point |
| Spirit | Mana Well, Battle Hymn, Amber Amplifier | +1 maximum mana per permanent point |

Base HP is 60. Base maximum mana is 7. Regeneration is 4 per turn unless the Meditation talent raises it to 5. Permanent resource-capacity increases preserve missing HP/mana; they do not fully heal the character. Temporary attribute bonuses never change capacities, regeneration, resistances, or talent eligibility.

### Talents and resistances

At **2 Vitality**, choose Iron Skin (resist 1 physical damage per hit) or Antitoxin (resist 2 poison damage per tick).

At **2 Spirit**, choose Meditation (+1 mana regenerated per turn) or Arcane Warding (resist 2 arcane damage per hit).

Choose a newly unlocked talent before confirming allocation. A confirmed talent is locked for the run. Refunding a newly allocated threshold point removes its unconfirmed talent. Physical/arcane resistance is applied before block; poison bypasses block but is reduced by poison resistance. Resistance never produces healing or negative damage.

## How rolls work

```text
Adjusted roll = max(0, raw face + permanent attribute + temporary bonuses/penalties)
Final effect = (adjusted roll + adjusted additive modifiers) × multiplier modifiers
```

Each modifier uses its own attribute. Apply the target's attribute only once. A multiplier converts its adjusted roll using `ceil(adjusted / 2)`, bounded to **×1–×3**. Multiple multipliers can still stack. Effects have a numerical safety ceiling of 999.

Example: Iron Strike face 4 + Might 2 = 6; Gilded Plus face 4 + Finesse 1 = +5; Echo Prism face 4 + Arcana 0 = ×2. The final attack is `(6 + 5) × 2 = 22` before Battle Hymn power and enemy defenses.

The UI shows raw face, permanent attribute, temporary effects, and attachment arithmetic. Rerolls replace only the raw face. Nudge adds 1 to the raw face up to its highest engraved face; an attribute-adjusted result may exceed that maximum. A stat-adjusted six is not a natural six.

**Quick Cut is a free emergency attack capped at 3 total damage**, including attributes, attachments, and Battle Hymn power. Mana Well costs 1 mana and skips 2 future turns, so scaling it is not a free resource engine.

## Combat loop

1. Select up to five ready dice within the mana budget. Selection reserves mana; rolling pays it. Include at least one effect die.
2. Roll all selected dice. One Recollection is free each turn; further rerolls cost 1 mana and Nudge costs 2.
3. Attach each purple modifier to one effect die, freely. Modifiers can be moved or detached. Modifier-to-modifier chaining is not supported.
4. Reorder effect dice, then commit. Battle Hymn power applies to the next two attacks; Platebreaker strips armor before later physical hits. Poison bypasses enemy armor and block.
5. The enemy acts unless killed or interrupted. Meet a charged move's stagger threshold to interrupt the whole move, including penalties. Used dice skip the stated number of future turns.
6. After a non-final victory, allocate a stat point, choose a die/rest/forge reward, then visit the shop. HP persists; battle statuses and cooldowns reset between fights.

### Focus and enemy counterplay

**Focus** costs 2 mana and adds +2 to a chosen attribute **for the current turn only**. Use it before or after rolling through the character sidebar. It skips two future turns after use. Focus cannot spend mana already reserved for the jar.

The Mire Alchemist's Numbing Vines telegraphs **−2 Finesse for your next turn** and is interruptible with 5 stagger. The Jarbreaker's Corrupting Blow telegraphs **−2 Arcana for your next turn** and can be interrupted with 6 stagger. These penalties are additive, expire after that one player turn, and do not permanently alter the character. Focus can offset a penalty without deleting it.

The Jarbreaker's Arcane Shatter and Corrupting Blow deal arcane damage. Other current attacks are physical. Intents show damage type, penalty, and interrupt threshold before commitment.

## Develop and test

Node.js 20+ is required only for development. There are no npm/runtime dependencies.

```sh
npm run dev       # rebuild the standalone game and serve localhost:5173
npm run build     # regenerate index.html after source changes
npm run check     # syntax, exact generated-file verification, and automated tests
npm test          # deterministic engine, UI, and offline packaging tests
```

Edit the modules and `src/index.template.html`, not the generated `index.html`. Always rebuild and commit the generated file so downloaded repository ZIPs remain playable directly.

An optional graphical smoke test is in `tests/browser-smoke.py`. It requires Python, Playwright, and Chromium (or `CHROMIUM_PATH`) and is not part of the game's runtime. It exercises the exact standalone HTML in an isolated browser document with networking blocked, at desktop and mobile sizes. Screenshots/results are written to ignored `test-results/`. This environment blocks `file://` navigation; the smoke test therefore loads the HTML directly, while Node tests independently verify self-contained packaging and startup/reset behavior.

## Code layout

```text
src/content.js              Dice, encounters, attributes, talents, balance constants
src/attributes.js           Pure attribute and derived-resource calculations
src/game.js                 Immutable reducer, roll breakdowns, combat, progression
src/character-ui.js          Allocation screen, stat sidebar, visible roll arithmetic
src/main.js                 Combat/progression UI and pointer/keyboard interactions
src/index.template.html     Editable HTML and field guide
styles.css                  Shared responsive presentation
scripts/build-standalone.js  Dependency-ordered, zero-dependency offline exporter
scripts/server.js           Optional local HTTP server
index.html                  Generated standalone player-facing game
```

The reducer accepts an RNG for deterministic tests. Character creation and level-up use explicit phases, validated point allocation, and required talent choices. The legacy combat suites use zero-stat fixtures so old combat behavior and new character behavior are tested separately.

## Deployment

The existing GitHub Actions workflow runs `npm run check` and deploys when GitHub Pages has been enabled. In repository Settings → Pages, select GitHub Actions as the deployment source. The standalone HTML can also be uploaded to any static host.

## Current scope

This is a playable prototype, not final balance. All dice remain six-sided. No saves, branching route map, equipment inventory, audio, permanent account progression, or full damage-type ecosystem yet. Stats, poison, stacking modifiers, mana generation, and enemy difficulty need further playtesting as a combined economy.

## License

MIT; see LICENSE.
