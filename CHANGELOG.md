# Changelog

## 0.4.0 — Rounds and equipment

- Replaced the combined player-cast/scripted-enemy loop with alternating main actions and committed reaction rolls.
- Replaced abstract owned dice with equipment instances, shared maneuver recovery, backpack/loadout management, finite consumables, and refilling.
- Added independent damage/accuracy/poison modifiers, Block/Dodge/Ward/Counterstrike/Catch Breath/Parry, Shield Bash with Poise and Resolve, and symmetric poison timing.
- Preserved and adapted attributes, talents, Focus, upgrades, rewards, shop, and four encounters. Enemy actions now use actual equipment and the same resource rules.
- Changed resource recovery to two mana per round (three with Meditation), with one free reroll shared between offense and defense.
- Replaced scope-flattening with an isolated-module standalone exporter, retaining a direct-open HTML artifact and no runtime dependencies.
- Added deterministic rule/campaign tests, seeded policy probes, and full offline graphical regression through a four-encounter run.

This is a first balance pass. No saves, tactical grid, multiple enemies, equipment durability, or full elemental system are included.
