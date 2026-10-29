# Implemented v0.4 combat contract

This document describes the implementation; `round-equipment-plan.md` retains the pre-implementation specification. The legacy all-dice cast and fixed enemy move path have been removed.

## State and commands

`schemaVersion: 4` separates `phase` (campaign) from `combat.stage`. `combatants.hero` and `combatants.enemy` are the only authoritative combatant objects; there is no duplicate `state.hero` or abstract `state.dice`. Each has attributes, HP/mana, passive defenses, owned items, `equippedItemIds`, main/reaction allowances, one free reroll per round, poison, power/weakening, temporary penalties, pending skip, Resolve, and Focus readiness.

The reducer clones before mutation. A command requires `expectedRevision`. A battle command also requires its exact `exchangeId` and the current decision owner. A successful command increments revision; rejected or unknown commands do not consume gameplay resources or random draws. `NEW_GAME` increments revision rather than reverting it, invalidating stale controls. An invalid RNG provider is a developer error, not a legal action result.

Stages: `action -> reaction -> manipulate_actor -> manipulate_defender -> summary`. Passing a reaction skips its rolling/manipulation. Passing a main turn creates no reaction opportunity. Summaries are acknowledged by the human before progression; the enemy controller cannot skip a human decision. The browser's bounded synchronous AI loop sends the same reducer commands as a player.

## Commitment, reveal, locking

Drafting is free and reversible. Declaration validates the complete bundle before spending mana, consuming a charge, reserving item availability, and consuming the appropriate allowance. The action is committed before the defender chooses its reaction; both are committed before reveal. Primary and support identities cannot be changed afterward.

RNG order is actor primary, actor supports in selection order, defender primary, defender supports. Reroll draws exactly one face for its selected item. Public previews use min/max/mean values and do not advance RNG. Raw faces are never overwritten with attribute-adjusted totals.

The acting side locks its computed result first, then the defender. Resolution uses these locked values, not a recomputation after applying effects. Focus affects only its owner's results in this exchange and never changes permanent capacities. Temporary penalties applied now become eligible only in a future rolled exchange; each is consumed once at that exchange's end.

## Resolution order

1. Test a committed, eligible Dodge against accuracy or Parry against separate parry difficulty. Equality succeeds. Successful avoidance cancels the primary effect and attached poison. Costs remain spent.
2. For a landed HP attack: physical armor, matching flat resistance, eligible Block/Ward, then HP loss. Clamp every layer at zero. Attack power/weakening and final caps are calculated before these defenses.
3. Apply weapon poison only on positive HP damage. Direct poison application is reduced by Ward, not poison resistance; poison resistance reduces later ticks.
4. For non-HP effects, use the explicit kind: healing, recovery, armor removal, poison, weakening, rally, attribute penalty, or stagger. Block/Ward applies only through compatible tags. Shields do not react to a potion.
5. If both combatants remain alive, resolve the already committed Counterstrike or Catch Breath. Stagger schedules a later main skip and does not cancel this committed reaction. Counterstrike does not provide protection and cannot trigger a response.
6. Consume eligible rolled-exchange penalties and attack-buff charges; attack attempts consume power/weakening even if missed or parried. End the exchange once and evaluate lethal outcomes.

Healing and Channel can be answered by Catch Breath, but not Block. Recovery is unavailable before resolution. Catch Breath halves the complete modified recovery result, rounding down; its UI shows the actual mana result. All numerical effects are capped at 999 unless a maneuver has a smaller cap.

## Turn and round boundaries

The turn-order array is initially `['hero','enemy']`. Begin a main slot by checking `pendingSkip`. A forced skip consumes that main allowance, grants Resolve, and goes to summary. A non-skipped main slot clears Resolve when acknowledged, including voluntary Pass and an action canceled by Parry. Reactions never clear it; pending skips never stack.

After both slots, compute both poison ticks from the same snapshot, subtract poison resistance, apply damage, and decay stacks once. Simultaneous poison death is a draw that ends the run with no rewards. Earlier lethal exchange damage ends combat immediately with no later poison tick.

At each subsequent round start, restore each actor's main/reaction allowances and free reroll and regenerate mana once. Round one starts at full mana and gets no additional grant. Item availability is absolute: `round + recovery + 1`. Focus returns at `round + 3`.

## Equipment, progression, and migration decisions

Eight equipped items, with a required Focus Crystal and at least one repeatable offensive action. The crystal occupies a normal slot. Its zero-cost Channel spends the main action and blocks same-round Catch Breath use, replacing the old Mana Well intentionally. Owned item IDs, face arrays, charges, and readiness are validated. Multiple copies are independent; multiple maneuvers on one copy are not.

A victory retains normal attribute allocation, rewards, shop, and forge. Item acquisition goes to owned inventory; equip it at the next loadout screen. Charges persist; the shop explicitly replenishes a consumable for gold. Battle statuses, mana, and readiness reset before the next encounter. HP and upgrades persist. This game still has no persistence system or existing saved-state migration requirement.

Starting gear has 13 items and 8 equipped by default. Spell/ward/venom/potion options are available in the backpack immediately. Parrying Dagger, War Horn, Hex Wand and other gear enter through rewards/shop. Four opponents use real loadouts, attributes, legal resource costs, and the same state machine. The AI receives no future-roll data. Its policy is deliberately heuristic rather than optimal.

Poise and physical armor are separate: armor and HP resistance do not reduce Bash stagger. Poise is currently a visible actor stat, not an automatically attribute-derived value. Firebolt uses arcane resistance; a separate fire damage system is deferred.

## Release verification

`npm run check`, 100 strict seeded simulations, and graphical browser regression are separate checks. Graphical CI uses the exact checked-in standalone HTML and requires real file navigation, with HTTP requests blocked. The approved plan's PR-sized stages were implemented on a single isolated integration branch and reviewed together; the playable default branch is not switched until the complete release checks pass.
