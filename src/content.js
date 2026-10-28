// Data-driven content. Every die has exactly one effect; rolled values supply its magnitude.
export const DICE = {
  strike: { attribute: 'might', name: 'Iron Strike', family: 'attack', icon: '⚔', cooldown: 0, manaCost: 1, description: 'Deal damage equal to the result.', flavor: 'A dependable edge.' },
  quick: { attribute: 'finesse', name: 'Quick Cut', outputCap: 3, family: 'attack', icon: '⚔', cooldown: 0, manaCost: 0, description: 'Free fallback: deal up to 3 physical damage, including all bonuses.', flavor: 'Speed is its own weapon.' },
  guard: { attribute: 'vitality', name: 'Stone Guard', family: 'block', icon: '⬡', cooldown: 0, manaCost: 1, description: 'Gain block equal to the result.', flavor: 'Weather the next blow.' },
  venom: { attribute: 'finesse', name: 'Viper Venom', family: 'poison', icon: '☣', cooldown: 1, manaCost: 2, description: 'Apply poison equal to the result. Poison damages at enemy turn start, then decays by 1.', flavor: 'The wound keeps working.' },
  hex: { attribute: 'arcana', name: 'Binding Hex', family: 'weaken', icon: '✧', cooldown: 1, manaCost: 1, description: 'Reduce the next enemy attack by the result.', flavor: 'Even giants can stumble.' },
  rally: { attribute: 'spirit', name: 'Battle Hymn', family: 'strength', icon: '✷', cooldown: 2, manaCost: 2, description: 'Next 2 attack dice gain +ceil(result ÷ 2) damage.', flavor: 'Make every strike count.' },
  plus: { attribute: 'finesse', name: 'Gilded Plus', family: 'add', icon: '+', cooldown: 1, manaCost: 1, description: 'Attach to an effect die. Add the rolled value to its result.', flavor: 'A little more of everything.' },
  multiply: { attribute: 'arcana', name: 'Echo Prism', family: 'multiply', icon: '×', cooldown: 2, manaCost: 3, description: 'Attach to an effect die. Multiply its result by ceil(adjusted roll ÷ 2), minimum ×1 and maximum ×3.', flavor: 'Make a whisper thunder.' },
  channel: { attribute: 'spirit', name: 'Mana Well', family: 'mana', icon: '✺', cooldown: 2, manaCost: 1, description: 'Restore mana equal to the result (up to max mana).', flavor: 'Bottle a spark of magic.' },
  mend: { attribute: 'vitality', name: 'Restoration', family: 'heal', icon: '✚', cooldown: 2, manaCost: 2, description: 'Heal HP equal to the result (up to max HP).', flavor: 'An ember of warmth.' },
  saber: { attribute: 'finesse', name: 'Silver Saber', family: 'attack', icon: '⚔', cooldown: 1, manaCost: 1, description: 'Deal damage equal to the result.', flavor: 'Sharper than it looks.' },
  bastion: { attribute: 'vitality', name: 'Iron Bastion', family: 'block', icon: '⬡', cooldown: 1, manaCost: 1, description: 'Gain block equal to the result.', flavor: 'A fortress in your palm.' },
  blight: { attribute: 'arcana', name: 'Black Spores', family: 'poison', icon: '☣', cooldown: 2, manaCost: 2, description: 'Apply poison equal to the result.', flavor: 'The forest remembers.' },
  fracture: { attribute: 'arcana', name: 'Fracture Sigil', family: 'weaken', icon: '✧', cooldown: 0, manaCost: 1, description: 'Reduce the next enemy attack by the result.', flavor: 'Ruin their momentum.' },
  amplify: { attribute: 'spirit', name: 'Amber Amplifier', family: 'add', icon: '+', cooldown: 2, manaCost: 2, description: 'Attach to an effect die. Add the rolled value.', flavor: 'Power with a price.' },
  prism: { attribute: 'arcana', name: 'Crimson Prism', family: 'multiply', icon: '×', cooldown: 2, manaCost: 3, description: 'Attach to an effect die. Multiply by ceil(adjusted roll ÷ 2), minimum ×1 and maximum ×3.', flavor: 'Strength through refraction.' },
  anthem: { attribute: 'spirit', name: 'War Anthem', family: 'strength', icon: '✷', cooldown: 1, manaCost: 2, description: 'Next 2 attack dice gain +ceil(result ÷ 2) damage.', flavor: 'A rhythm for battle.' },
  spring: { attribute: 'vitality', name: 'Bright Spring', family: 'heal', icon: '✚', cooldown: 1, manaCost: 2, description: 'Heal HP equal to the result.', flavor: 'A sip of tomorrow.' },
  sunder: { attribute: 'might', name: 'Platebreaker', family: 'sunder', icon: '⚒', cooldown: 1, manaCost: 1, description: 'Permanently remove armor equal to the result. Armor reduces each physical hit.', flavor: 'Crack the iron shell.' },
  stagger: { attribute: 'might', name: 'Disruptor', family: 'stagger', icon: '⚡', cooldown: 1, manaCost: 1, description: 'Apply stagger equal to the result. Meet a charged attack threshold to interrupt it.', flavor: 'Stop the blow before it falls.' },
  parry: { attribute: 'finesse', name: 'Duelist Parry', family: 'block', icon: '⬡', cooldown: 0, manaCost: 1, description: 'Gain block equal to the result. Scales with Finesse.', flavor: 'Turn their strength aside.' },
  barrier: { attribute: 'arcana', name: 'Arcane Barrier', family: 'block', icon: '⬡', cooldown: 0, manaCost: 1, description: 'Gain block equal to the result. Scales with Arcana.', flavor: 'Will made solid.' },
};

export const STARTING_DICE = [
  'strike', 'quick', 'guard', 'venom', 'hex', 'rally', 'plus', 'multiply', 'channel', 'mend', 'sunder', 'stagger'
];
export const REWARD_POOL = ['saber','bastion','blight','fracture','amplify','prism','anthem','spring','venom','guard','plus','multiply','channel','rally','sunder','stagger','parry','barrier'];

export const ENCOUNTERS = [
  {
    name: 'Scrap Brute', subtitle: 'THE FORGOTTEN WORKSHOP', icon: '⚒', hp: 40, gold: 24,
    moves: [
      { name: 'Heavy Swing', attack: 7 },
      { name: 'Brace & Bash', attack: 4, guard: 5 },
      { name: 'Overhead Slam', attack: 14, interruptAt: 5 },
    ],
  },
  {
    name: 'Mire Alchemist', subtitle: 'THE WITHERED GARDENS', icon: '☣', hp: 50, gold: 29,
    moves: [
      { name: 'Toxic Dart', attack: 5, poison: 2 },
      { name: 'Vial Shield', guard: 7 },
      { name: 'Numbing Vines', attack: 9, interruptAt: 5, statPenalty: { attribute: 'finesse', amount: 2 } },
    ],
  },
  {
    name: 'Hollow Sentinel', subtitle: 'THE SILENT CITADEL', icon: '♜', hp: 66, gold: 36, armor: 3, mechanic: 'Plated: each physical hit loses 3 damage. Sunder removes armor; poison bypasses it.',
    moves: [
      { name: 'Shield March', guard: 7, attack: 5 },
      { name: 'Iron Cleave', attack: 11 },
      { name: 'Judgment', attack: 15 },
    ],
  },
  {
    name: 'The Jarbreaker', subtitle: 'THE FINAL CHAMBER', icon: '♛', hp: 86, gold: 0,
    moves: [
      { name: 'Arcane Shatter', attack: 10, damageType: 'arcane' },
      { name: 'Glass Fortress', guard: 9, attack: 6 },
      { name: 'Corrupting Blow', attack: 8, damageType: 'arcane', poison: 3, interruptAt: 6, statPenalty: { attribute: 'arcana', amount: 2 } },
      { name: 'Crushing Finale', attack: 21, interruptAt: 7 },
    ],
  },
];

export const FAMILY = {
  attack: { label: 'Attack', accent: 'ember', desc: 'Damage' },
  block: { label: 'Defense', accent: 'azure', desc: 'Block' },
  poison: { label: 'Debuff', accent: 'verdant', desc: 'Poison' },
  weaken: { label: 'Debuff', accent: 'verdant', desc: 'Weaken' },
  strength: { label: 'Buff', accent: 'gold', desc: 'Empower' },
  sunder: { label: 'Disruption', accent: 'gold', desc: 'Strip armor' },
  stagger: { label: 'Disruption', accent: 'gold', desc: 'Stagger' },
  mana: { label: 'Utility', accent: 'cyan', desc: 'Mana' },
  heal: { label: 'Utility', accent: 'cyan', desc: 'Heal' },
  add: { label: 'Modifier', accent: 'violet', desc: 'Add' },
  multiply: { label: 'Modifier', accent: 'violet', desc: 'Multiply' },
};

export const MAX_JAR = 5;
export const MAX_MANA = 7;
export const MANA_REGEN = 4;
export const FREE_RECOLLECTIONS = 1;
export const REROLL_COST = 1;
export const NUDGE_COST = 2;
export const SHOP_DIE_COST = 22;
export const SHOP_FORGE_COST = 16;
export const SHOP_HEAL_COST = 13;

// Permanent attributes are small additive roll bonuses; temporary effects never alter capacities.
export const ATTRIBUTES = {
  might: { name: 'Might', icon: '⚔', description: 'Physical power, armor breaking, and interruption.' },
  finesse: { name: 'Finesse', icon: '◇', description: 'Precise strikes, poison, parries, and additive modifiers.' },
  arcana: { name: 'Arcana', icon: '✧', description: 'Hexes, barriers, and multiplier reliability (maximum ×3).' },
  vitality: { name: 'Vitality', icon: '♥', description: 'Guard and healing dice. Each point adds 6 maximum and current HP.' },
  spirit: { name: 'Spirit', icon: '✦', description: 'Mana and buff dice. Each point adds 1 maximum mana.' },
};
export const STARTING_ATTRIBUTE_POINTS = 3;
export const STARTING_ATTRIBUTE_CAP = 2;
export const ATTRIBUTE_CAP = 4;
export const BASE_HP = 60;
export const HP_PER_VITALITY = 6;
export const FOCUS_COST = 2;
export const FOCUS_BONUS = 2;
export const FOCUS_COOLDOWN = 2; // Future turns skipped, just like dice.
export const TALENTS = {
  iron_skin: { attribute: 'vitality', name: 'Iron Skin', description: 'Resist 1 physical damage per enemy hit, before block.', resistance: 'physical', amount: 1 },
  antitoxin: { attribute: 'vitality', name: 'Antitoxin', description: 'Resist 2 poison damage per tick. Poison still decays normally.', resistance: 'poison', amount: 2 },
  meditation: { attribute: 'spirit', name: 'Meditation', description: 'Regenerate 1 additional mana each turn (5 total).', manaRegen: 1 },
  warding: { attribute: 'spirit', name: 'Arcane Warding', description: 'Resist 2 arcane damage per enemy hit, before block.', resistance: 'arcane', amount: 2 },
};
