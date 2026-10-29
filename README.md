# Jarbound — Rounds & Equipment v0.4

A single-player, equipment-building dice roguelike. Your items define your actions; character attributes improve their dice. Commit a maneuver, answer your opponent, manipulate the rolls, and save resources for the other half of the round.

## Play immediately

**Extract the ZIP and double-click `index.html`.** The generated HTML includes all JavaScript and styles. No installation, server, account, build step, or internet connection is needed. The standalone HTML can also be copied by itself.

New Run returns to character creation. There is **no save system**: refreshing or closing the page discards your run.

1. Allocate **3 attribute points**, with at most 2 in one attribute. Choose any unlocked talent.
2. Equip up to **8 items**. Your backpack contains additional spells, wards, poison, and potions. Keep a Focus Crystal and a repeatable attack or poison spell equipped.
3. On your main turn, select **one maneuver + up to two supporting items**. Commit the action. Its mana, charges, and equipment availability are now spent.
4. The enemy commits its reaction before either side rolls. Both sides reveal their dice. You manipulate and lock first; the enemy then locks its reaction.
5. Read the outcome and Continue. On the enemy's main turn, choose **one reaction + up to one support**, or Pass. You see its declared maneuver and range, not its future rolls.
6. After the enemy exchange, poison ticks for both sides and a new round begins. Mana and free rerolls refresh once per round, not between the two turns.
7. Win an encounter, allocate a new attribute point, choose a reward, visit the shop, and adjust your loadout before the next fight. There are four opponents.

## Equipment is not just a die skin

Each owned item has its own faces, charges, and next-ready round. A Shield provides **Block** and **Shield Bash**; a Short Sword provides **Quick Strike** and **Counterstrike**. The maneuvers share the same physical item. Using your shield to Bash means you cannot also Block with that shield later in the round. Two separate shields have independent recovery.

Forging one item face improves every maneuver on that item. Swapping equipment never resets charges or upgrades. Battle initialization resets recovery and temporary effects, but **not consumable charges**. Potions and venom can be replenished explicitly at the shop.

A legal loadout includes the reusable Focus Crystal: **Channel** is a zero-mana main action that recovers the roll, while **Catch Breath** is a reaction that recovers half, rounded down, after the incoming action. Both use the same crystal. Passing is always legal. Recovery arrives only on resolution and cannot finance its own reroll in advance.

### Maneuvers and reactions

| Equipment / maneuver | Behavior |
|---|---|
| Warhammer / Heavy Strike | Strong physical hit; lower accuracy and one additional recovery round. |
| Warhammer / Platebreaker | Remove armor for the encounter instead of dealing HP damage. |
| Short Sword / Quick Strike | More accurate physical hit with no additional recovery round. |
| Shield / Block | Reduce a blockable physical hit or impact. |
| Shield / Shield Bash | Apply stagger instead of HP damage; meeting Poise denies the next main action. |
| Nimble Boots / Dodge | Meet or exceed accuracy to avoid an eligible maneuver entirely. Failure offers no protection. |
| Parrying Dagger / Parry | Meet a melee maneuver's separate parry difficulty to cancel the current action only. |
| Short Sword / Counterstrike | Retaliate if you survive. Provides no mitigation and never opens another reaction. |
| Ward Focus / Ward | Reduce wardable magical damage or spell-application strength. |
| Fire Wand / Firebolt | Arcane damage; “fire” is descriptive, not another resistance system in this release. |
| Venom Staff / Venom Cloud | Apply poison directly; Dodge avoids application and Ward reduces stacks. |
| Healing Potion / Drink | Spend a charge to heal. The amount varies; the drink does not have a separate failure roll. |

## Attributes and numerical channels

Every maneuver has exactly one associated attribute: **Might, Finesse, Arcana, Vitality, or Spirit**. Individual maneuvers on the same item can use different attributes. Raw faces remain separate from adjusted results.

```text
Adjusted die = max(0, raw face + permanent attribute + temporary effects)
Primary output = (adjusted primary + compatible additions) × multipliers
Accuracy = maneuver accuracy + aiming modifiers
Weapon poison payload = venom attachment output
```

Attack power and weakening apply after the primary calculation; the maneuver's total-output cap applies last. Each multiplier converts its adjusted result to `ceil(result / 2)`, bounded to ×1–×3. Multipliers stack, but never automatically multiply accuracy or attached venom. Damage and accuracy are independent. Accuracy is a Dodge difficulty, **not a universal percentage chance to hit**; there is no extra attack-success roll.

A weapon's poison applies only if it inflicts at least one point of health damage. A fully blocked or dodged hit applies none. Poison spells do not need an initial wound. Poison ticks simultaneously at round end, bypasses armor and block, is reduced by poison resistance, and decays by one. A simultaneous poison defeat is a draw without rewards.

### Resources and character growth

- Base health **60**, plus **6 per Vitality**. Base mana **7**, plus **1 per Spirit**.
- Base mana regeneration **2 per round**; Meditation raises it to 3. Each battle starts at full mana without extra first-round regeneration.
- **One free Recollection per round**, shared by your action and reaction. Additional rerolls cost 1 mana; nudging a raw face by +1 costs 2, up to its highest engraved face.
- **Focus** costs 2 mana, adds +2 to a chosen attribute for the current exchange, and skips two future rounds. Use it only in your own manipulation window.
- Each non-final victory grants one attribute point, up to 4 in each attribute. At 2 Vitality choose physical or poison resistance; at 2 Spirit choose regeneration or arcane resistance.
- Permanent capacity increases preserve missing HP/mana. Temporary bonuses and penalties never change capacities or talent eligibility.
- Numbing Vines and Corrupting Sigil affect one **future rolled exchange**, not already-locked results. Passing does not consume those penalties.

Equipment readiness uses `readyRound = currentRound + additionalRecoveryRounds + 1`. An item used in round 3 with no extra recovery returns in round 4; with one extra recovery, it returns in round 5. The same rule applies to modifiers, actions, and reactions.

### Interruptions without permanent stun locks

Block reduces impact; Parry cancels the current eligible melee action; Shield Bash denies the target's **next main action** if remaining stagger reaches Poise. These are three different effects. Armor and HP resistance do not reduce stagger; eligible Block does.

Partial stagger does not carry over. Pending skips do not stack. After a forced skip, **Resolve** prevents another until the target completes a later non-skipped main-turn slot (a voluntary Pass counts). Reactions do not clear Resolve. Skipping a main action does not remove a committed reaction or stop round progression.

## Development and testing

Node.js 20+ is needed only for development. There are no npm packages to install.

```bash
npm run build                # Regenerate standalone index.html
npm run check                # Syntax, definitions, output freshness, Node tests
npm test                     # Deterministic engine / campaign / packaging / UI tests
npm run simulate -- --strict # 100 seeded policy probes; fail if any hit the round cap
npm run dev                  # Build and serve locally on http://localhost:5173
```

The reducer remains `reduceGame(state, action, rng)`. Recognized commands require the current `expectedRevision`; combat commands also require actor and exchange IDs. The renderer never draws random values or mutates resources. Selection AI receives a public view with no unrevealed rolls or future RNG stream. Both sides pay through the same reducer.

Optional graphical checks require Python and Playwright, not game runtime dependencies:

```bash
python -m pip install -r requirements-browser.txt
python -m playwright install chromium
python tests/browser-smoke.py --require-file
```

CI installs browser OS dependencies as well. It requires actual `file://` navigation. Restricted local environments can omit `--require-file`; a blocked file navigation is then reported explicitly, and the exact standalone HTML is tested in an isolated document with networking disabled. That fallback is **not** reported as a direct-file pass. The suite covers desktop, mobile, both combat roles, Focus, shared rerolls, Bash/Resolve, talents, reset/help, and a complete four-encounter campaign including level-ups, shopping, and forging. Fixed legal rolls make the campaign test a progression check, not a balance claim.

Results are written to `test-results/`. Simulations report capped samples rather than adding a forced-loss timer to the actual game. Probe outcomes are AI-policy comparisons with fresh starting resources per encounter, not human win rates.

## Code organization

`content.js` defines equipment, maneuvers, and encounters; `equipment.js` owns validation and availability; `attributes.js` is combatant-neutral; `effects.js` calculates results; `combat.js` owns rounds/exchanges; `enemy-ai.js` selects legal decisions; and `game.js` owns the campaign. UI modules render those states without independent combat calculations. `scripts/build-standalone.js` bundles named local modules into isolated scopes and fails on unsupported syntax, dependency cycles, or missing exports.

See `docs/combat-v04.md` for the timing contract, `docs/test-migration.md` for regression coverage changes, and `docs/round-equipment-plan.md` for the approved historical plan.

## Scope and balance

This is a first equipment/rounds prototype, not a finished balance pass. It uses fixed hero-first order and one opponent at a time. There is no save system, movement grid, durability, detailed hand/weight model, multiplayer, or reaction-to-reaction chain. Equipment uses text/icons; no new character art is included. Revisit mana costs, defensive thresholds, and encounter tuning after human playtesting.

GitHub Actions tests the source and direct-open browser build before optional Pages deployment. Hosting requires Pages to be enabled in repository Settings; downloading the game does not.

## License

MIT — see `LICENSE`.
