# Regression coverage migration: v0.3 -> v0.4

The old 64-test suite passed on the v0.3 baseline before editing. The old combined turn function, abstract die ownership, `select/cast` phases, fixed enemy damage, and four-mana-per-turn regeneration are intentionally replaced. Tests expecting those obsolete contracts were rewritten against the explicit new behavior rather than retained through a production legacy adapter.

| Existing guarantee | v0.4 coverage |
|---|---|
| Independent editable faces, immutable state, illegal input handling | `equipment.test.js`, `game.test.js`, `attributes.test.js` |
| Jar budgeting, modifier compatibility, costs and no refunds | `equipment.test.js`, `combat-overhaul.test.js` |
| Separate raw faces, permanent attributes, multiplier limits, one-time target bonus | `attributes.test.js`, `combat-overhaul.test.js` |
| Free then paid rerolls; capped nudges and unavailable Focus | `combat-overhaul.test.js`, `attributes.test.js` |
| Damage, armor, block, poison, weakening, power, sunder | `combat-overhaul.test.js` with symmetric actors and explicit exchange rules |
| Exact cooldown duration | `equipment.test.js`, `combat-overhaul.test.js` with absolute round readiness |
| Victory/rewards, health persistence, shop, forge, next encounter, final outcomes | `game.test.js`, plus actual-control graphical campaign |
| Character allocation caps, refunds, talents, derived health/mana | `attributes.test.js`, browser creation/talent checks |
| Offline startup, New Run, generated output freshness, DOM rendering | `offline.test.js`, `ui.test.js`, `browser-smoke.py` |

New coverage adds shared alternate-item maneuvers, eight-item loadouts/backpacks, finite charges and refills, one action/reaction per round, symmetric poison ticks, direct-vs-weapon poison, separate accuracy, defensive contests, live/dead Counterstrike, round-end draws, pending skip and Resolve across turn orders, locked-value timing, stale revision/exchange rejection, no RNG consumption from previews/rejections, AI public-view isolation, and private-module scope isolation in the offline exporter.

`tests/helpers.js` explicitly documents deterministic fixtures. Some rule/campaign tests construct controlled states to isolate a boundary. The graphical campaign separately traverses real controls for all four encounters, three level-ups, an item purchase, a face upgrade, and equipment selection. It uses fixed **legal dice results** to validate progression, not infer difficulty.

`npm run simulate -- --strict` executes 100 policy-vs-policy probes across five builds and four encounters. It checks resource and charge invariants, reports any round cap, and fails the check on capped samples; no such timer is added to real gameplay. An initial heuristic repeatedly bashed low-health enemies; the policy was corrected to value finishing damage, with a regression test.

The browser test reports its navigation mode. `--require-file` must succeed with `file://` in CI. Without that flag, a restricted local environment can fall back to an isolated document loaded from the exact standalone HTML, recording the original navigation failure. These modes are never conflated. Desktop/mobile checks reject JavaScript errors, HTTP requests, invalid-action toasts, and horizontal overflow.
