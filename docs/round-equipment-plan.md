# Jarbound v0.4 — Rounds and Equipment Implementation Plan

**Repository:** `AWDaley/DiceGame`  
**Reviewed baseline:** `main` at `1b058aea11d0e20886b3f34583c7913b1c55f6be`  
**Status:** Proposed implementation specification. No gameplay changes or repository writes are part of this planning step.  
**Purpose:** Replace the current player-cast/enemy-response loop with equipment-driven actions and reactive dice rolls while retaining character progression and the downloadable, double-click playable game.

## 1. Goal and scope

The new combat loop is: choose a maneuver from equipment, commit its supporting items, let the opponent commit a reaction, roll both sides, manipulate the results, and resolve the exchange. On the other combatant's turn, the roles reverse.

Build a shared rules engine rather than a special player engine with a scripted enemy shortcut. Both combatants have attributes, health, mana, equipment, charges, cooldowns, an action allowance, and a reaction allowance. Their content and AI can differ, but the resource and resolution rules are shared.

Keep plain JavaScript, the pure reducer architecture, deterministic tests, character creation, attribute allocation, talents, rewards, the shop, and forging. The playable build must remain a self-contained HTML file without installation, a server, or network access.

The first release is one hero versus one enemy. Defer initiative rolls, movement grids, multiple simultaneous enemies, extra-action chains, equipment durability, detailed hand/weight restrictions, nested modifier chains, and a full save system. Use existing interface styling and text/icons; an art overhaul is not required.

All new balance values below are initial test settings, not claims of final balance.

## 2. What must change in the current code

`src/game.js` currently resolves all selected player effects, applies an enemy move from `ENCOUNTERS.moves`, and advances the turn inside `commitTurn()` and `nextTurn()`. Those responsibilities must be separated. Adding a reaction prompt inside the existing function would leave timing and resource logic entangled.

`src/attributes.js` currently reads `state.hero` and `state.turn` directly. Convert combat calculations to accept a combatant and an explicit timing context so enemy dice use the same attribute rules. Keep character-allocation helpers separate from combat calculations.

`src/content.js` currently defines abstract dice and enemies with fixed numeric moves. Replace combat-facing definitions with equipment, maneuvers, and enemy loadouts. Preserve attribute and talent data, with revised descriptions where turn semantics change.

`src/main.js` currently assumes a player-only collection, selection/cast phases, and fixed enemy intent. Replace that battle presentation while retaining the campaign screens and event delegation.

`scripts/build-standalone.js` has a fixed module list and concatenates stripped modules in one scope. New modules require an exporter change, not just new imports. Preserve the build freshness check and add module isolation to prevent duplicate helper names.

## 3. Rules contract

| System | Initial rule |
|---|---|
| Round | One hero main-turn slot, followed by one enemy main-turn slot. |
| Turn order | Hero first for v0.4; order is stored in data for future changes. |
| Main action | At most one declared maneuver in the combatant's main-turn slot. |
| Reaction | At most one committed reaction per round, answering the opponent's declared action. |
| Action jar | One primary maneuver die and up to two compatible modifier dice. |
| Reaction jar | One primary reaction die and up to one compatible modifier die. |
| Resource sharing | Main actions, reactions, and manipulation use the same mana pool. |
| Equipment sharing | All maneuvers belonging to an item use that item's shared availability and charges. |
| Base mana regeneration | Start testing at 2 per round; Meditation adds 1. |
| Starting resources | Each battle starts at full mana. Round 1 does not add regeneration on top. |
| Recollection | One free reroll per combatant per round, shared between action and reaction. |
| Paid manipulation | Further rerolls cost 1 mana; nudges cost 2. Recovered mana is unavailable until its effect resolves. |
| Loadout | Start with 8 equipped item instances; other owned items stay in the backpack. |
| Equipment swapping | Allowed before battle and between encounters, never mid-battle. |
| Reactions to reactions | Not allowed. Counterstrike does not open another response window. |
| Emergency progression | Passing is always legal. A required reusable focus crystal provides a zero-mana Channel main action. |

Use named constants for the jar limits, loadout capacity, regeneration, and costs. Do not spread balance literals across the engine and interface.

## 4. Equipment and maneuver model

### Separate three things

**Item definition** describes the kind of object: shield, sword, boots, staff, charm, or potion. It lists available maneuvers and default faces.

**Item instance** is the particular object the character owns. It stores its unique ID, upgraded faces, charges, and next available round. Two swords of the same type must not share mutable arrays or cooldown state.

**Maneuver definition** describes one use of the object: Slash, Counterstrike, Block, Shield Bash, Channel, and so on. It specifies whether it is an action, reaction, or modifier; its attribute; cost; recovery; effect; and compatibility tags.

A shield may offer Block using Vitality and Shield Bash using Might. There is still only one shield die and one item recovery timer. An upgrade to its shared face array improves both maneuvers; the forge must communicate that explicitly.

Illustrative data shape, not production code:

```js
const shieldDefinition = {
  id: 'round_shield',
  name: 'Round Shield',
  category: 'shield',
  defaultFaces: [1, 2, 3, 4, 5, 6],
  maneuverIds: ['shield_block', 'shield_bash'],
};

const shieldBlock = {
  id: 'shield_block',
  timing: 'reaction',
  attribute: 'vitality',
  manaCost: 1,
  recoveryRounds: 0,
  effect: { kind: 'block' },
  respondsTo: ['blockable_physical', 'blockable_impact'],
};

const ownedShield = {
  id: 'item-17',
  definitionId: 'round_shield',
  faces: [2, 2, 3, 4, 5, 6],
  charges: null, // null means non-consumable
  readyRound: 1,
};
```

Keep `equippedItemIds` as the authoritative equipped list; do not also maintain a separately mutable `equipped` boolean on each item. Validate ownership, unique IDs, capacity, nonnegative finite charges, valid faces, and definition references.

### Initial content

| Equipment | Maneuvers | Intended identity |
|---|---|---|
| Warhammer | Heavy Strike; armor-breaking maneuver | High output, lower accuracy, longer recovery. |
| Short sword | Quick Strike; Counterstrike | More accurate, cheaper, short recovery. |
| Worn knife | Weak free strike | Optional capped fallback, not a full-power free attack. |
| Shield | Block; Shield Bash | Reliable physical defense or offensive turn denial, never both from the same instance in one round. |
| Nimble boots | Dodge | Avoid an eligible attack by meeting its accuracy. |
| Fire wand | Firebolt | Arcane damage; fire is initially a descriptive tag, not a second resistance system. |
| Venom staff | Poison spell | Direct poison application without a weapon wound. |
| Ward focus | Ward | Reduce magical damage or a wardable spell's application strength. |
| Focus crystal | Channel; Catch Breath | Main-action recovery or weaker reactive recovery. |
| Power charm | Add effect strength | Increase the primary numerical effect, not every attached payload. |
| Aiming lens | Add accuracy | Improve hit reliability against Dodge. |
| Echo crystal | Multiply primary effect | Bounded multiplier; does not multiply accuracy or attached poison. |
| Venom vial | Poison attachment | Adds poison when a weapon causes health damage. |
| Healing potion | Drink | Heal a rolled amount; finite charges. |
| Parrying weapon | Parry | Interrupt an eligible melee attack; advanced reaction content. |

A legal loadout must include the focus crystal and at least one repeatable offensive main maneuver. The crystal consumes a normal loadout slot. Its Channel maneuver has zero mana cost and no extra-round recovery because spending the main action is the opportunity cost; its item still cannot be used again in the same round. This is an intentional redesign of the old Mana Well, not an accidental retention of free generation.

## 5. Round and exchange state machines

Do not use one `phase` variable for both the campaign and the duel. Keep campaign phases such as character, loadout, battle, levelup, reward, shop, forge, won, and lost separate from combat stages.

Suggested state responsibilities:

```text
run
  schemaVersion
  campaign phase / encounter / gold / reward offers
  combatants[hero, enemy]
    hp, mana, attributes, talents, resistances, armor, poise
    ownedItems, equippedItemIds
    mainActionAvailable, reactionAvailable, freeRecollections
    statuses, pendingSkip, resolveProtection, focusReadyRound
  combat
    roundNumber, turnOrder, activeTurnIndex
    stage, exchangeId, decisionRevision
    actionDraft, committedAction
    reactionDraft, committedReaction
    rawRolls, finalLockedValues
    manipulationActorId
  structured combat events
```

The hero and enemy should not maintain duplicate combat state through a mixture of old `state.hero`, new `combatants.hero`, and old `state.dice`. Use adapters only during migration, then remove them.

### Round lifecycle

```text
ROUND START
  Refresh action/reaction allowance and free rerolls.
  Apply round-boundary resource recovery and expiry once.
  HERO TURN
    Check forced skip; otherwise run an exchange or voluntary Pass.
  ENEMY TURN
    Check forced skip; otherwise run an exchange or voluntary Pass.
ROUND END
  Tick poison for both sides from the same snapshot.
  Decay poison and expire round-scoped effects.
  Resolve victory/defeat and advance the round if combat continues.
```

A forced skip still passes through its turn boundary hooks. It does not stop round progression, resource regeneration, or equipment recovery. It does not remove a still-available defensive reaction. Pass and a forced skip do not create a reaction opportunity because neither declares a maneuver.

### Exchange lifecycle

```text
MAIN_ACTION_DRAFT
  -> MAIN_ACTION_COMMIT
  -> REACTION_DRAFT
  -> REACTION_COMMIT or PASS_REACTION
  -> REVEAL_BOTH_ROLLS
  -> ACTOR_MANIPULATION -> LOCK_ACTOR
  -> DEFENDER_MANIPULATION -> LOCK_DEFENDER
  -> RESOLVE_EXCHANGE
  -> EXCHANGE_SUMMARY
  -> ADVANCE_TURN
```

During drafting, selection is reversible and merely reserves resources. On commit, validate and pay costs atomically; consume a charge, allowance, and item availability exactly once. The defender sees the declared items, tags, effect ranges, and accuracy information before choosing a reaction, but no raw results.

Both sides commit before either side rolls. Once committed, items, maneuver, targets, and modifier channels cannot be replaced. Attachments in this one-primary system have an unambiguous target; post-roll interaction changes numerical results, not the declared action's identity.

The active side manipulates first and locks; the defender manipulates second. This knowingly gives the defender the final manipulation opportunity. There is no return to the first window. Each side may manipulate only its own rolled dice and use only its own resources.

If the defender passed, skip its roll and manipulation stages. AI stages auto-advance, but stop before every required human choice. An exchange summary can be a single Continue control rather than adding confirmation to every automatic stage.

All actions should carry actor identity and an expected exchange/decision revision. Reject stale clicks, wrong-owner actions, duplicate commits, and wrong-stage requests without consuming resources or RNG.

## 6. Roll and effect calculations

Store raw faces separately from adjusted values. For each primary or modifier die:

```text
adjusted = max(0, rawFace + permanentAttribute + temporaryAttributeEffects)
```

Apply the primary's attribute once and each modifier's own attribute once. A reroll replaces the raw face only. A nudge changes the raw face within its engraved maximum. Rendering, previews, and rejected actions must not consume RNG.

For an ordinary numerical primary effect:

```text
primaryEffect = clamp(
  (adjustedPrimary + sum(compatibleEffectAdditions))
  * product(compatibleEffectMultipliers),
  0,
  primaryOutputCap
)

accuracy = baseAccuracy + sum(accuracyAdditions)
poisonPayload = sum(eligibleVenomAttachmentOutputs)
```

Use the current multiplier conversion `ceil(adjusted / 2)` capped to x1–x3 for each modifier. Never multiply accuracy or an added poison payload just because the primary damage is multiplied. Validate modifiers against explicitly declared channels such as damage, block, stagger, healing, recovery, or poison application. Unsupported combinations must be rejected, not silently ignored. Accuracy modifiers are not eligible for a Counterstrike in v0.4 because it cannot be answered by Dodge or another reaction.

Aiming improves a Dodge contest; it is not a universal chance-to-hit percentage. In v0.4, an attack connects unless an eligible avoidance or interruption effect prevents it. Do not introduce a separate attack-success roll as part of this migration. A heavy strike's accuracy and its damage remain independent.

### Reaction rules

| Reaction | Resolution |
|---|---|
| Block | Subtract rolled block from a blockable physical hit or blockable impact packet, such as Shield Bash. Block expires after this exchange. |
| Dodge | If adjusted dodge meets or exceeds attack accuracy, avoid the eligible maneuver and its on-hit payloads; otherwise no active protection. |
| Ward | Subtract rolled ward from wardable magical damage or wardable spell-application strength. |
| Counterstrike | After the main action resolves, attack back only if alive and the incoming maneuver was eligible. It grants no protection by itself. |
| Catch Breath | After the main action resolves, recover `floor(modifiedRecoveryResult / 2)` mana if alive. It can answer non-hostile actions as well as attacks. |
| Parry | Meet a declared parry difficulty to cancel an eligible current melee action. This cancels that action only, not another future action. |

An attack's parry difficulty is separate metadata, not automatically its damage value. Parry is narrower than Dodge and should not be a universal best reaction. Block is not an offensive stun; the shield's separate Bash maneuver handles that.

### Resolution order

1. Verify that both committed selections and finalized rolls are valid. The reducer should make this true by construction.
2. Evaluate successful Dodge or Parry. Avoided/cancelled primary actions produce no primary damage or on-hit payload.
3. For a landed damage packet, subtract physical armor when applicable, then the matching flat resistance, then eligible Block or Ward. Clamp every stage at zero. Apply HP loss.
4. Apply attached venom only if that weapon packet caused at least one HP damage. Apply other explicitly defined payloads with their own condition; do not make every status an automatic on-hit rider.
5. Resolve primary non-HP effects through their specific rules: healing, recovery, poison application, armor removal, or stagger. Defensive compatibility is determined by tags, not by assuming that every effect is damage.
6. Check immediate terminal state. A dead defender cannot Counterstrike, recover, or open another window.
7. If combat continues, resolve the committed Counterstrike or Catch Breath. A Counterstrike uses ordinary damage/venom rules against passive defenses but opens no new reaction.
8. Consume exchange-limited status uses, expire exchange buffs, emit events, and end the exchange exactly once.

Counterstrike does not itself provide mitigation. Being staggered by the incoming action schedules the next main-action skip; it does not retroactively cancel an already committed reaction. Clearly document this distinction.

For direct poison spells, Dodge avoids the application and Ward subtracts from its strength. Poison resistance reduces future poison damage, not the application itself. Weapon poison and poison spells therefore have distinct delivery rules.

## 7. Interruption and anti-lock rules

Shield Bash produces stagger instead of HP damage in the initial content. Resolve any eligible dodge/block first; compare remaining stagger to the defender's visible Poise. Physical HP resistance and armor do not reduce stagger unless an item explicitly grants stagger protection. Do not carry partial stagger across exchanges in the first release.

If the threshold is met, mark `pendingSkip` on the target. Its next main-turn slot is consumed without a maneuver. If it already acted this round, the skip applies to its next round's main slot.

A pending skip cannot stack. When the skip is consumed, grant Resolve protection. Resolve prevents another forced main-action skip until the target completes one later, non-skipped main-turn slot. A voluntary Pass counts as completing that slot; a defensive reaction does not. A declared main action that is parried still consumes that non-skipped slot and can clear Resolve at its end.

This lifecycle must be identical for enemies and heroes. Distinguish `ACTION_INTERRUPTED` (current action cancelled) from `MAIN_ACTION_SKIPPED` (future turn denial) in the log and tests.

Using the shield for Bash immediately shares its recovery with Block. A failed Bash therefore leaves the attacker without that same shield for defense later in the round.

## 8. Resource, cooldown, and status timing

Use absolute readiness rather than decrementing the old turn timer from several callbacks:

```text
item.readyRound = currentRound + maneuver.recoveryRounds + 1
```

An item used in round 3 with recovery 0 returns in round 4. Recovery 1 returns in round 5. Primary and modifier items follow the same rule; using either offensively or defensively marks the entire physical instance. Sharing a definition does not share a cooldown between two owned copies.

Each combatant's mana regenerates once at ROUND START, except the first round, where battle initialization already supplied full mana. Preserve maximum mana from Spirit and maximum health from Vitality. Starting base regeneration at 2 implies updating Meditation's text and derived total to 3, not leaving stale 5-per-turn descriptions.

Channel restores its modified recovery result after the exchange resolves; Catch Breath restores half of its modified recovery result, rounded down. Compatible recovery additions and multipliers apply before this halving. Neither can finance its own manipulation before resolution. Overflow is discarded at the maximum. A depleted or interrupted potion still spends its committed charge. Purchases or explicit replenishment restore charges; charges do not silently reset between fights.

Focus remains a manipulation ability rather than a second main maneuver. It costs 2 mana, adds +2 to one chosen attribute during the current exchange, and is available only during its owner's manipulation window. Set its readiness to `round + 3` to skip two future rounds. This intentionally replaces the ambiguous old 'this turn' duration with an explicit exchange duration.

Translate enemy temporary attribute penalties to one future exchange in which the affected combatant rolls an action or reaction. Effects applied in exchange N cannot alter already-locked rolls in N; they become eligible later and are consumed once at that future exchange's end. Pass/forced skip does not consume a rolled-exchange effect. Expose that wording in the tooltip. Clear all battle-scoped effects between fights.

For poison, apply both combatants' end-of-round ticks from the same pre-tick snapshot, bypassing armor and block, reducing by poison resistance, then decaying stacks by 1. A fully resisted tick still decays. No tick generates a reaction. If both die to the same boundary, record a draw and end the player's run without rewards. Earlier lethal exchange damage ends combat immediately; do not continue ticking after a terminal result.

## 9. Interface plan

Add a loadout screen after character creation and before each battle. Show equipped items, backpack items, associated attributes, all available maneuvers, faces, charges, costs, and recovery. Selecting a primary should visibly filter legal modifiers; an item with multiple maneuvers must explain their shared readiness.

The battle screen should make round number, active actor, and remaining main/reaction allowances prominent. Show both mana pools, item readiness, Poise, Resolve, and relevant statuses. Ready, used this round, recovering, unaffordable, and depleted are different states and need distinct labels beyond color alone.

The action panel presents one primary slot and two support slots. The reaction panel presents the incoming declared maneuver and its range, then only compatible reactions plus a clear Pass button. A healing potion should never invite an impossible Block reaction.

The roll panel presents both sides' raw and adjusted dice, separated damage/accuracy/payload values, manipulation ownership, and arithmetic. Before results are revealed, show ranges; after both sides lock, show exact outcomes calculated by the engine. Never show hidden raw values or imply a guaranteed outcome while the opponent can still manipulate.

Remove free ordering of several unrelated effects from the old cast screen. Resolution order is defined by maneuver rules. Preserve keyboard controls, focus restoration, touch interactions, and a compact mobile layout. Every illegal action should explain why it is unavailable.

The combat log should be generated from structured events, for example: 'Accuracy 8 beats Dodge 6', 'Shield blocks 7; 1 HP lost', or 'Bash causes next main action to be skipped; shield ready in round 4'. This event data also supports tests and debugging.

## 10. Enemy decision system

Expose `chooseAction(publicView, policy)` and `chooseReaction(publicView, declaredAction, policy)` rather than giving AI unrestricted access to the entire game object or RNG stream. Decision views include known stats, mana, equipment readiness, effects, declared items, and legal options. They exclude unrevealed faces and future draws.

During manipulation, the AI sees only information available in that stage. The actor sees both initial rolls; the defender sees the actor's locked result. Both use the same reducer commands, costs, item limits, and free-reroll allowance as the hero. Use deterministic tie-breaking or a separately controlled policy RNG so action selection does not consume combat dice draws.

Start with readable policies rather than elaborate search:

- A Sentinel favors Block, uses Bash selectively, and saves its shield when defensive value is high.
- A Duelist favors accurate attacks, Dodge, and survivable Counterstrike opportunities.
- An Alchemist/Mage uses poison or magic, reserves Ward resources, and Channels when low.

Convert the four existing encounters to item-based loadouts and valid resource-paying maneuvers before release. The Jarbreaker can use a larger or stronger loadout; do not retain hidden fixed attacks that bypass costs. Any later boss exception should be displayed as an explicit trait.

Do not promise a fixed enemy move at round start if AI may choose differently after the hero's action. Show tendencies or a provisional plan; the actual declaration becomes authoritative on the enemy's turn.

## 11. Proposed code layout

| File | Responsibility |
|---|---|
| `src/content.js` | Equipment/maneuver definitions, enemy loadouts, tags, balance constants, reward tables, talent text. |
| `src/equipment.js` — new | Instance creation, loadout validation, compatible maneuvers/modifiers, charges and readiness. |
| `src/attributes.js` | Combatant-neutral attributes and derived stats; keep allocation-specific helpers explicit. |
| `src/combat.js` — new | Round and exchange state machine; command validation; atomic commitments; event generation. |
| `src/effects.js` — new | Pure roll breakdown, accuracy contests, defenses, statuses, stagger, shared preview/resolution calculations. |
| `src/enemy-ai.js` — new | Public decision views and deterministic action/reaction/manipulation policies. |
| `src/game.js` | Campaign reducer, creation, progression, shop, forge; delegates battle actions. |
| `src/battle-ui.js` — new | Action/reaction drafting, roll comparison, prompts, combat log rendering. |
| `src/loadout-ui.js` — new | Equipped/backpack presentation and between-battle selection. |
| `src/character-ui.js` | Existing character screens with round-based descriptions and neutral stat helpers. |
| `src/main.js` | Browser controller, event dispatch, accessibility/focus, bounded automatic AI advancement. |
| `scripts/build-standalone.js` | Scoped bundling of the expanded local module graph into the existing single-file launcher. |

Keep JSDoc types and runtime definition validation; a TypeScript/framework migration is not necessary for this feature. Maintain an acyclic module graph: data -> attributes/equipment -> effects -> combat -> campaign -> UI/controller. AI consumes public views and commands, not UI state.

Keep the established `reduceGame(state, action, rng)` entry point. Suggested commands include SELECT_MANEUVER, TOGGLE_MODIFIER, DECLARE_ACTION, DECLARE_REACTION, PASS_REACTION, REROLL, NUDGE, FOCUS, LOCK_RESULT, ACK_EXCHANGE, and PASS_TURN. All mutations run through the reducer; the browser must not assign mana or HP directly.

Store structured events such as ACTION_DECLARED, REACTION_DECLARED, DIE_ROLLED, RESULT_LOCKED, ATTACK_AVOIDED, DAMAGE_APPLIED, STATUS_APPLIED, MAIN_ACTION_SKIPPED, and ROUND_STARTED. Raw RNG draws occur only on valid reveal/reroll transitions, once each, with a reproducible draw order. UI rendering and previews are pure.

## 12. Implementation sequence and acceptance gates

Use `feature/round-equipment-v04` as the integration branch. Keep `main` playable until the complete vertical slice passes its gates. The following units can be reviewed separately and integrated in order; they are not authorization to merge incomplete combat screens into the live game.

### PR 1 — Contracts, neutral calculations, and build safety

Record the rules above in `docs/combat-v04.md`; introduce typed definitions/validators and combatant-neutral attribute helpers. Update the offline exporter to use an explicit topological module manifest with isolated module scopes and validated named imports/exports, rejecting unsupported syntax. Extend syntax checking to all source modules instead of the current hard-coded list.

**Gate:** Existing behavior and tests remain intact, the same source deterministically produces the same standalone output, and two modules with the same private helper name do not collide.

### PR 2 — Equipment instances and loadout progression

Create item/maneuver definitions, instances, loadout validation, and the equipment screen. Convert current die acquisition/forging to item ownership and shared faces, with a temporary adapter for legacy combat where necessary. Add charges, readyRound, equipped/backpack distinctions, and mandatory viable loadout validation.

**Gate:** Duplicate copies are independent; shared shield maneuvers use one timer; swapping cannot reset charge/recovery state; forging changes only the chosen owned instance. Equip a legal loadout and return through existing character/reward/shop screens without losing stats.

### PR 3 — Headless alternating rounds and commitment

Implement round start/end, hero/enemy slots, action/reaction drafts, atomic commitment, simultaneous reveal, sequential manipulation, and exact resource refresh. Use simple attack and Block fixtures plus Pass to prove the lifecycle. Add deterministic enemy commands through the same reducer rather than a separate damage path.

**Gate:** A complete round refreshes resources once, each side acts at most once and reacts at most once, every commit charges exactly once, and an item cannot be reused for its alternate maneuver or as support during the round.

### PR 4 — Complete resolution and counterplay

Add Dodge, Ward, Counterstrike, Catch Breath, Channel, poison spell/weapon delivery, accuracy and effect modifiers, Shield Bash, Resolve, and Parry. Port Focus, temporary penalties, armor removal, and existing buff semantics to named events with explicit durations. Existing attack-buff charges must specify that an attack attempt—including a missed/parried attack or a Counterstrike—consumes one eligible charge, and apply once rather than twice. Reapply an item's total damage cap after these bonuses so the weak free knife cannot exceed its cap.

**Gate:** All rules work with either actor as the attacker, immunity stops repeated turn denial, poison has symmetric timing, and reaction resolution cannot recurse.

### PR 5 — Interactive battle interface

Connect action/reaction and manipulation screens, resource forecasts, item states, roll arithmetic, summaries, and logs. Preserve the current character screen and offline delivery. Stop controller auto-advancement whenever the player has a decision. Use exchange/revision checks to prevent stale asynchronous callbacks or double clicks from altering a later exchange.

**Gate:** A human can complete a full round from either decision role using mouse, touch, or keyboard; New Run resets every stage; previews match actual resolution without consuming RNG.

### PR 6 — Enemy policies and full campaign conversion

Implement the Sentinel, Duelist, and Mage/Alchemist policies and migrate all four encounters. Convert rewards, shop, rest, forging, consumable replenishment, and between-encounter loadout changes. Remove legacy fixed enemy moves and the temporary combat adapter after tests cover the new route.

**Gate:** A full four-encounter run can be completed, including level-ups and gear changes; no enemy receives free hidden maneuvers, and depleted consumables do not refill accidentally.

### PR 7 — Balance, regression, and release packaging

Add deterministic full-round examples, seeded simulations, and browser coverage. Tune costs, accuracy, Poise, output, and recovery from actual playtests. Build the exact standalone HTML from reviewed source, package a source ZIP, update the README/help, and verify the generated file is current in CI.

**Gate:** No invalid states or deadlocks in simulation, existing campaign guarantees remain covered, complete browser flows pass, and the downloaded standalone build runs without network dependencies. Only then merge and label the release v0.4.

## 13. Test matrix

| Test group | Required cases |
|---|---|
| Equipment | Independent duplicate instances; shared Shield Block/Bash readiness; duplicate item selection rejected; backpack access forbidden in battle; finite charges; no swap-based reset. |
| Round lifecycle | Two main slots and one reaction each; no double regeneration; skipped main still advances; Pass always legal; cooldowns ready on exact intended round. |
| Commitments | Draft/cancel free; main/reaction costs paid once; invalid/wrong-owner/stale commands spend nothing and draw nothing; no refund after a miss/interruption. |
| Manipulation | Shared free reroll across action/reaction; only raw face changes; owner-only access; actor locks before defender; no manipulation after lock; recovery not usable early. |
| Attributes | Primary bonus once; each modifier bonus once; no temporary increase to health/mana capacity; correct Focus duration and round recovery. |
| Accuracy | Dodge equality succeeds; damage additions do not change accuracy; accuracy additions do not change damage; attack range never reveals future RNG. |
| Protection | Armor/resistance/block order; Ward on appropriate magic only; no negative HP loss/healing from defense; block expires after exchange. |
| Poison | Fully blocked/dodged weapon applies none; penetrating weapon applies payload; spell application reduced by Ward; resistance affects tick; ticks simultaneous, decay once, no reactions. |
| Counterstrike | No mitigation; dead defender cannot counter; a living staggered defender can finish its already committed reaction; no counter-to-counter chain. |
| Interruption | Bash before versus after target's main; partial stagger discarded; pending skips do not stack; Resolve lifecycle; Parry cancels current action only. |
| Progression | Attributes/talents/face upgrades persist; rewards and shop create items; charges persist; battle statuses and readiness reset intentionally; no partial source-of-truth duplication. |
| Enemy fairness | Same resources and legal-item validation; reaction chosen before reveal; AI cannot read future random results; deterministic legal fallback when no attack affordable. |
| Packaging/UI | Creation -> loadout -> action -> reaction -> reward -> next fight -> reset; keyboard/touch paths; no overflow; zero external runtime requests; direct-open file test. |

Retain existing tests for unchanged requirements. Rewrite tests whose old turn semantics are intentionally replaced, noting the new contract. Do not simply delete failing tests to achieve a green run.

### Deterministic golden-round example

Use explicit raw faces and no passive defenses:

- Hero starts with 7 mana, commits a 1-mana sword and 1-mana lens: 5 remains. Sword face 4 + Finesse 1 = 5 damage. Lens face 2 + Finesse 1 adds 3 to base accuracy 5, producing accuracy 8.
- Enemy commits Dodge before reveal. Its final Dodge is 6, so the attack lands for 5. Its boots are unavailable for the rest of the round.
- Enemy then declares a maneuver with a finalized 8 damage. Hero commits a 1-mana shield and 1-mana power charm: 3 mana remains. Shield face 3 + Vitality 1 = 4; charm face 2 + Finesse 1 = 3; total block is 7. Hero loses 1 HP.
- No free reroll is replenished between those exchanges. At round 2 start, hero regains 2 mana, reaching 5. Recovery-0 equipment becomes available; longer-recovery equipment does not.

Add separate golden cases for successful Dodge, lethal incoming attacks, poison delivery, Bash/Resolve across three rounds, and an enemy that has already acted before being staggered.

### Automated balancing checks

Run seeded duels for balanced, Might, Finesse, Arcana, and Vitality/Spirit-oriented builds. Record HP lost, rounds, recovery turns, mana utilization, reaction frequency, stun/skip frequency, and outcome. Abort simulation samples at a generous round cap and report them as non-terminating samples, not wins; do not add an arbitrary forced-loss timer to the actual game merely to make simulations finish.

Enumerate die-face outcomes when assessing Dodge and Parry chances. A d6 plus a high attribute can make a low fixed difficulty automatic; costs and recovery must keep one reaction from solving every encounter. Do not target a specific win rate until the desired difficulty is established.

## 14. Offline and release safeguards

Edit source files and the HTML template, not generated `index.html` by hand. Regenerate the launcher on every source change. The exporter must inline all required logic and styles, preserve module scope, escape inline script termination, and fail when an import cannot be bundled.

Keep `npm run build`, `npm run check`, and `npm test`. Extend `check` to cover new modules, definitions, and output freshness. Extend `tests/browser-smoke.py` for the new phase progression. Add a real `file://` navigation test where the browser runner permits it; loading HTML with `set_content` is useful but is not the same test. If file navigation is blocked, report that limitation and require a direct-open check in a permitted environment before claiming it passed.

Release deliverables: reviewed source, updated README and in-game guide, regenerated standalone HTML, complete source ZIP, green CI, test evidence, and a short change log explaining that dice now come from equipped items and that one round includes two opposing main turns.

## 15. First playable milestone

Before expanding content, prove one sword, one shield, one focus crystal, and one shared modifier in a duel:

**Player declares an attack -> enemy commits Block -> both roll/manipulate -> resolve -> enemy attacks -> player chooses Block, recovery, or Pass -> round advances.**

Then add Shield Bash to that same shield and verify that using it offensively makes it unavailable defensively. This milestone validates the most important design change before a large inventory and enemy roster are built around it.

## Source grounding

Repository snapshot inspected for this plan: `AWDaley/DiceGame@1b058aea11d0e20886b3f34583c7913b1c55f6be`.

| Inspected source | Relevance |
|---|---|
| `src/game.js` | Current combined cast/enemy resolution, resource timing, progression, die ownership. |
| `src/attributes.js` | Hero-specific attribute helpers, derived resources, temporary effects, Focus, multiplier bounds. |
| `src/content.js` | Existing dice, fixed enemy moves, mana constants, attributes, talents. |
| `src/main.js` | Current selection/cast interface, action routing, character/progression screens. |
| `scripts/build-standalone.js` | Explicit flattening of named modules and offline HTML freshness check. |
| `tests/browser-smoke.py` | Existing desktop/mobile checks and file-navigation limitation. |
| `package.json` | Current version and build/test/check scripts. |
| Repository tree | Existing module and regression-test layout. |

The proposed rules, file additions, costs, loadout limits, and implementation stages are design decisions for v0.4, not descriptions of already implemented behavior.
