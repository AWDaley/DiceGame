/** v0.4 rules are data, shared by the hero, AI, previews and tests. */
export const VERSION = '0.4.0';
export const LOADOUT_CAP = 8;
export const ACTION_SUPPORTS = 2;
export const REACTION_SUPPORTS = 1;
export const MAX_MANA = 7;
export const MANA_REGEN = 2;
export const BASE_HP = 60;
export const HP_PER_VITALITY = 6;
export const STARTING_ATTRIBUTE_POINTS = 3;
export const STARTING_ATTRIBUTE_CAP = 2;
export const ATTRIBUTE_CAP = 4;
export const FREE_RECOLLECTIONS = 1;
export const REROLL_COST = 1;
export const NUDGE_COST = 2;
export const FOCUS_COST = 2;
export const FOCUS_BONUS = 2;
export const FOCUS_RECOVERY = 2;
export const SHOP_ITEM_COST = 22;
export const SHOP_FORGE_COST = 16;
export const SHOP_HEAL_COST = 13;
export const SHOP_REFILL_COST = 9;
export const ATTRIBUTES = {
  might: { name: 'Might', icon: '⚔', description: 'Heavy weapons, armor breaking and Shield Bash.' },
  finesse: { name: 'Finesse', icon: '◇', description: 'Swords, dodges, parries, precision and venom attachments.' },
  arcana: { name: 'Arcana', icon: '✧', description: 'Spell strength, magical wards and multiplier reliability.' },
  vitality: { name: 'Vitality', icon: '♥', description: 'Shields and healing. Each permanent point adds 6 maximum HP.' },
  spirit: { name: 'Spirit', icon: '✦', description: 'Recovery and rallying. Each permanent point adds 1 maximum mana.' },
};
export const TALENTS = {
  iron_skin: { attribute: 'vitality', name: 'Iron Skin', description: 'Resist 1 physical HP damage per hit, before Block.', resistance: 'physical', amount: 1 },
  antitoxin: { attribute: 'vitality', name: 'Antitoxin', description: 'Resist 2 poison damage per round-end tick.', resistance: 'poison', amount: 2 },
  meditation: { attribute: 'spirit', name: 'Meditation', description: 'Regenerate 1 extra mana per round (3 total).', manaRegen: 1 },
  warding: { attribute: 'spirit', name: 'Arcane Warding', description: 'Resist 2 arcane HP damage per hit, before Ward.', resistance: 'arcane', amount: 2 },
};
const melee = ['hostile', 'weapon', 'melee', 'blockable', 'dodgeable', 'parryable', 'counterable'];
const spell = ['hostile', 'spell', 'wardable', 'dodgeable'];
/** Each maneuver has one attribute and one primary numerical effect. */
export const MANEUVERS = {
  heavy_strike: { name: 'Heavy Strike', timing: 'action', kind: 'attack', attribute: 'might', manaCost: 2, recoveryRounds: 1, damageType: 'physical', accuracy: 5, parryDifficulty: 10, tags: melee, description: 'Heavy physical damage. Slow recovery and easier to dodge.' },
  sunder: { name: 'Platebreaker', timing: 'action', kind: 'sunder', attribute: 'might', manaCost: 1, recoveryRounds: 0, accuracy: 6, parryDifficulty: 8, tags: ['hostile','melee','blockable','dodgeable','parryable','counterable'], description: 'Remove armor permanently for this encounter. No HP damage.' },
  quick_strike: { name: 'Quick Strike', timing: 'action', kind: 'attack', attribute: 'finesse', manaCost: 1, recoveryRounds: 0, damageType: 'physical', accuracy: 7, parryDifficulty: 8, tags: melee, description: 'A precise physical strike. Shares recovery with Counterstrike.' },
  knife_strike: { name: 'Desperate Cut', timing: 'action', kind: 'attack', attribute: 'finesse', manaCost: 0, recoveryRounds: 0, damageType: 'physical', accuracy: 5, parryDifficulty: 6, outputCap: 3, tags: melee, description: 'Free fallback; at most 3 damage, including every bonus.' },
  counterstrike: { name: 'Counterstrike', timing: 'reaction', kind: 'counter', attribute: 'finesse', manaCost: 1, recoveryRounds: 0, damageType: 'physical', tags: ['weapon'], respondsTo: ['counterable'], description: 'If you survive, retaliate after the incoming action. Does not protect you.' },
  block: { name: 'Block', timing: 'reaction', kind: 'block', attribute: 'vitality', manaCost: 1, recoveryRounds: 0, tags: [], respondsTo: ['blockable'], description: 'Reduce a blockable physical hit or impact by the result.' },
  shield_bash: { name: 'Shield Bash', timing: 'action', kind: 'stagger', attribute: 'might', manaCost: 2, recoveryRounds: 0, accuracy: 6, parryDifficulty: 9, tags: ['hostile','melee','blockable','dodgeable','parryable','counterable'], description: 'Meet Poise after defense to cancel the target’s next main action. No HP damage.' },
  dodge: { name: 'Dodge', timing: 'reaction', kind: 'dodge', attribute: 'finesse', manaCost: 2, recoveryRounds: 0, tags: [], respondsTo: ['dodgeable'], description: 'Meet attack accuracy to avoid it completely. Failure gives no protection.' },
  firebolt: { name: 'Firebolt', timing: 'action', kind: 'attack', attribute: 'arcana', manaCost: 2, recoveryRounds: 0, damageType: 'arcane', accuracy: 6, tags: spell, description: 'Deal arcane damage. Fire is a flavor tag, not a separate resistance.' },
  poison_spell: { name: 'Venom Cloud', timing: 'action', kind: 'poison', attribute: 'arcana', manaCost: 2, recoveryRounds: 1, accuracy: 6, tags: spell, description: 'Apply poison directly. Dodge avoids it; Ward reduces stacks.' },
  ward: { name: 'Ward', timing: 'reaction', kind: 'ward', attribute: 'arcana', manaCost: 1, recoveryRounds: 0, tags: [], respondsTo: ['wardable'], description: 'Reduce magical damage or spell application strength.' },
  channel: { name: 'Channel', timing: 'action', kind: 'recover', attribute: 'spirit', manaCost: 0, recoveryRounds: 0, tags: [], description: 'Recover the result as mana on resolution, instead of attacking.' },
  catch_breath: { name: 'Catch Breath', timing: 'reaction', kind: 'breath', attribute: 'spirit', manaCost: 0, recoveryRounds: 0, tags: [], respondsTo: ['any'], description: 'If alive, regain half the modified result, rounded down. No protection.' },
  drink: { name: 'Drink Potion', timing: 'action', kind: 'heal', attribute: 'vitality', manaCost: 0, recoveryRounds: 0, tags: [], description: 'Consume one charge and heal the rolled amount. Charges persist between fights.' },
  parry: { name: 'Parry', timing: 'reaction', kind: 'parry', attribute: 'finesse', manaCost: 2, recoveryRounds: 1, tags: [], respondsTo: ['parryable'], description: 'Meet parry difficulty to cancel the current melee action, not a later turn.' },
  rally: { name: 'Battle Hymn', timing: 'action', kind: 'rally', attribute: 'spirit', manaCost: 1, recoveryRounds: 1, tags: [], description: 'Next two attack attempts gain ceil(result / 2) damage. Misses use a charge.' },
  hex: { name: 'Binding Hex', timing: 'action', kind: 'weaken', attribute: 'arcana', manaCost: 1, recoveryRounds: 1, accuracy: 7, tags: spell, description: 'Reduce the target’s next attack attempt by the result.' },
  numbing: { name: 'Numbing Vines', timing: 'action', kind: 'penalty', attribute: 'arcana', penaltyAttribute: 'finesse', outputCap: 2, manaCost: 1, recoveryRounds: 1, accuracy: 7, tags: spell, description: 'Up to −2 Finesse for the target’s next rolled exchange.' },
  corrupt: { name: 'Corrupting Sigil', timing: 'action', kind: 'penalty', attribute: 'arcana', penaltyAttribute: 'arcana', outputCap: 2, manaCost: 1, recoveryRounds: 1, accuracy: 7, tags: spell, description: 'Up to −2 Arcana for the target’s next rolled exchange.' },
  add: { name: 'Empower', timing: 'modifier', kind: 'add', attribute: 'finesse', manaCost: 1, recoveryRounds: 0, tags: [], description: 'Add to the primary effect only. Not accuracy or attached poison.' },
  aim: { name: 'Aim', timing: 'modifier', kind: 'aim', attribute: 'finesse', manaCost: 1, recoveryRounds: 0, tags: [], description: 'Add accuracy to a dodgeable main maneuver; never adds damage.' },
  multiply: { name: 'Echo', timing: 'modifier', kind: 'multiply', attribute: 'arcana', manaCost: 3, recoveryRounds: 1, tags: [], description: 'Multiply the primary effect by ceil(adjusted / 2), capped ×1–×3.' },
  venom: { name: 'Coat Weapon', timing: 'modifier', kind: 'venom', attribute: 'finesse', manaCost: 1, recoveryRounds: 0, tags: [], description: 'Spend a charge. Apply this much poison only when the weapon causes HP damage.' },
};
export const EQUIPMENT = {
  warhammer: { name: 'Warhammer', icon: '⚒', category: 'Weapon', faces: [3,4,5,6,7,8], maneuvers: ['heavy_strike','sunder'] },
  short_sword: { name: 'Short Sword', icon: '⚔', category: 'Weapon', faces: [1,2,3,4,5,6], maneuvers: ['quick_strike','counterstrike'] },
  worn_knife: { name: 'Worn Knife', icon: '†', category: 'Weapon', faces: [1,2,3,4,5,6], maneuvers: ['knife_strike'] },
  round_shield: { name: 'Round Shield', icon: '⬡', category: 'Shield', faces: [1,2,3,4,5,6], maneuvers: ['block','shield_bash'] },
  nimble_boots: { name: 'Nimble Boots', icon: '◇', category: 'Footwear', faces: [1,2,3,4,5,6], maneuvers: ['dodge'] },
  fire_wand: { name: 'Fire Wand', icon: '✧', category: 'Spell focus', faces: [2,3,4,5,6,7], maneuvers: ['firebolt'] },
  venom_staff: { name: 'Venom Staff', icon: '☣', category: 'Spell focus', faces: [1,2,3,4,5,6], maneuvers: ['poison_spell'] },
  ward_focus: { name: 'Ward Focus', icon: '✥', category: 'Spell focus', faces: [1,2,3,4,5,6], maneuvers: ['ward'] },
  focus_crystal: { name: 'Focus Crystal', icon: '✦', category: 'Recovery', faces: [1,2,3,4,5,6], maneuvers: ['channel','catch_breath'] },
  power_charm: { name: 'Power Charm', icon: '+', category: 'Modifier', faces: [1,2,3,4,5,6], maneuvers: ['add'] },
  aiming_lens: { name: 'Aiming Lens', icon: '◎', category: 'Modifier', faces: [1,2,3,4,5,6], maneuvers: ['aim'] },
  echo_crystal: { name: 'Echo Crystal', icon: '×', category: 'Modifier', faces: [1,2,3,4,5,6], maneuvers: ['multiply'] },
  venom_vial: { name: 'Venom Vial', icon: '☣', category: 'Consumable modifier', charges: 3, faces: [1,2,3,4,5,6], maneuvers: ['venom'] },
  healing_potion: { name: 'Healing Potion', icon: '✚', category: 'Consumable', charges: 2, faces: [3,4,5,6,7,8], maneuvers: ['drink'] },
  parrying_dagger: { name: 'Parrying Dagger', icon: '†', category: 'Weapon', faces: [2,3,4,5,6,7], maneuvers: ['quick_strike','parry'] },
  war_horn: { name: 'War Horn', icon: '✷', category: 'Support', faces: [1,2,3,4,5,6], maneuvers: ['rally'] },
  hex_wand: { name: 'Hex Wand', icon: '⌁', category: 'Spell focus', faces: [1,2,3,4,5,6], maneuvers: ['hex'] },
  vine_staff: { name: 'Vine Staff', icon: '❧', category: 'Spell focus', faces: [1,2,3,4,5,6], maneuvers: ['numbing'] },
  corrupt_sigil: { name: 'Corrupting Sigil', icon: '✴', category: 'Spell focus', faces: [1,2,3,4,5,6], maneuvers: ['corrupt'] },
};
export const STARTING_ITEMS = ['short_sword','warhammer','round_shield','nimble_boots','focus_crystal','power_charm','aiming_lens','echo_crystal','fire_wand','venom_staff','ward_focus','venom_vial','healing_potion'];
export const REWARD_POOL = ['parrying_dagger','war_horn','hex_wand','vine_staff','corrupt_sigil','fire_wand','ward_focus','venom_staff','power_charm','aiming_lens','echo_crystal','venom_vial','healing_potion','short_sword','round_shield'];
export const ENCOUNTERS = [
  { name: 'Scrap Brute', subtitle: 'THE FORGOTTEN WORKSHOP', icon: '⚒', hp: 28, gold: 26, armor: 0, poise: 6, baseMana: 5, policy: 'brute', attributes: { might: 1, vitality: 1 }, items: ['warhammer','short_sword','round_shield','focus_crystal'], tendency: 'Heavy blows and basic blocks. Its hammer needs an extra round to recover.' },
  { name: 'Mire Alchemist', subtitle: 'THE WITHERED GARDENS', icon: '☣', hp: 34, gold: 30, armor: 0, poise: 6, baseMana: 6, policy: 'mage', attributes: { arcana: 1, spirit: 1 }, items: ['venom_staff','fire_wand','vine_staff','ward_focus','focus_crystal','nimble_boots'], tendency: 'Poison and arcane spells. Channels when depleted; wards magic.' },
  { name: 'Hollow Sentinel', subtitle: 'THE SILENT CITADEL', icon: '♜', hp: 42, gold: 38, armor: 2, poise: 8, baseMana: 6, policy: 'sentinel', attributes: { might: 1, vitality: 2 }, items: ['short_sword','warhammer','round_shield','focus_crystal','power_charm','parrying_dagger'], tendency: 'Armor and shields. Bash and Block share its shield. Sunder or poison bypass its armor.' },
  { name: 'The Jarbreaker', subtitle: 'THE FINAL CHAMBER', icon: '♛', hp: 54, gold: 0, armor: 1, poise: 9, baseMana: 7, policy: 'duelist', attributes: { might: 2, finesse: 2, arcana: 1, spirit: 1 }, items: ['short_sword','fire_wand','nimble_boots','ward_focus','focus_crystal','power_charm','corrupt_sigil','round_shield'], tendency: 'Precise strikes, evasive reactions and arcane pressure. Save resources for its response.' },
];
