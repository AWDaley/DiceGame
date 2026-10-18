// Data-driven content. Every die has exactly one effect; rolled values supply its magnitude.
export const DICE = {
  strike: { name: 'Iron Strike', family: 'attack', icon: '⚔', cooldown: 0, description: 'Deal damage equal to the result.', flavor: 'A dependable edge.' },
  quick: { name: 'Quick Cut', family: 'attack', icon: '⚔', cooldown: 0, description: 'Deal damage equal to the result.', flavor: 'Speed is its own weapon.' },
  guard: { name: 'Stone Guard', family: 'block', icon: '⬡', cooldown: 0, description: 'Gain block equal to the result.', flavor: 'Weather the next blow.' },
  venom: { name: 'Viper Venom', family: 'poison', icon: '☣', cooldown: 1, description: 'Apply poison equal to the result. Poison damages at enemy turn start, then decays by 1.', flavor: 'The wound keeps working.' },
  hex: { name: 'Binding Hex', family: 'weaken', icon: '✧', cooldown: 1, description: 'Reduce the next enemy attack by the result.', flavor: 'Even giants can stumble.' },
  rally: { name: 'Battle Hymn', family: 'strength', icon: '✷', cooldown: 2, description: 'Next 2 attack dice gain +ceil(result ÷ 2) damage.', flavor: 'Make every strike count.' },
  plus: { name: 'Gilded Plus', family: 'add', icon: '+', cooldown: 1, description: 'Attach to an effect die. Add the rolled value to its result.', flavor: 'A little more of everything.' },
  multiply: { name: 'Echo Prism', family: 'multiply', icon: '×', cooldown: 2, description: 'Attach to an effect die. Multiply its result by ceil(roll ÷ 2).', flavor: 'Make a whisper thunder.' },
  channel: { name: 'Mana Well', family: 'mana', icon: '✺', cooldown: 1, description: 'Restore mana equal to the result (up to max mana).', flavor: 'Bottle a spark of magic.' },
  mend: { name: 'Restoration', family: 'heal', icon: '✚', cooldown: 2, description: 'Heal HP equal to the result (up to max HP).', flavor: 'An ember of warmth.' },
  saber: { name: 'Silver Saber', family: 'attack', icon: '⚔', cooldown: 1, description: 'Deal damage equal to the result.', flavor: 'Sharper than it looks.' },
  bastion: { name: 'Iron Bastion', family: 'block', icon: '⬡', cooldown: 1, description: 'Gain block equal to the result.', flavor: 'A fortress in your palm.' },
  blight: { name: 'Black Spores', family: 'poison', icon: '☣', cooldown: 2, description: 'Apply poison equal to the result.', flavor: 'The forest remembers.' },
  fracture: { name: 'Fracture Sigil', family: 'weaken', icon: '✧', cooldown: 0, description: 'Reduce the next enemy attack by the result.', flavor: 'Ruin their momentum.' },
  amplify: { name: 'Amber Amplifier', family: 'add', icon: '+', cooldown: 2, description: 'Attach to an effect die. Add the rolled value.', flavor: 'Power with a price.' },
  prism: { name: 'Crimson Prism', family: 'multiply', icon: '×', cooldown: 2, description: 'Attach to an effect die. Multiply by ceil(roll ÷ 2).', flavor: 'Strength through refraction.' },
  anthem: { name: 'War Anthem', family: 'strength', icon: '✷', cooldown: 1, description: 'Next 2 attack dice gain +ceil(result ÷ 2) damage.', flavor: 'A rhythm for battle.' },
  spring: { name: 'Bright Spring', family: 'heal', icon: '✚', cooldown: 1, description: 'Heal HP equal to the result.', flavor: 'A sip of tomorrow.' },
};

export const STARTING_DICE = [
  'strike', 'quick', 'guard', 'venom', 'hex', 'rally', 'plus', 'multiply', 'channel', 'mend'
];
export const REWARD_POOL = ['saber','bastion','blight','fracture','amplify','prism','anthem','spring','venom','guard','plus','multiply','channel','rally'];

export const ENCOUNTERS = [
  {
    name: 'Scrap Brute', subtitle: 'THE FORGOTTEN WORKSHOP', icon: '⚒', hp: 40, gold: 24,
    moves: [
      { name: 'Heavy Swing', attack: 7 },
      { name: 'Brace & Bash', attack: 4, guard: 5 },
      { name: 'Overhead Slam', attack: 11 },
    ],
  },
  {
    name: 'Mire Alchemist', subtitle: 'THE WITHERED GARDENS', icon: '☣', hp: 50, gold: 29,
    moves: [
      { name: 'Toxic Dart', attack: 5, poison: 2 },
      { name: 'Vial Shield', guard: 7 },
      { name: 'Vine Lash', attack: 9 },
    ],
  },
  {
    name: 'Hollow Sentinel', subtitle: 'THE SILENT CITADEL', icon: '♜', hp: 66, gold: 36,
    moves: [
      { name: 'Shield March', guard: 7, attack: 5 },
      { name: 'Iron Cleave', attack: 11 },
      { name: 'Judgment', attack: 15 },
    ],
  },
  {
    name: 'The Jarbreaker', subtitle: 'THE FINAL CHAMBER', icon: '♛', hp: 86, gold: 0,
    moves: [
      { name: 'Shatter', attack: 10 },
      { name: 'Glass Fortress', guard: 9, attack: 6 },
      { name: 'Corrupting Blow', attack: 8, poison: 3 },
      { name: 'Crushing Finale', attack: 17 },
    ],
  },
];

export const FAMILY = {
  attack: { label: 'Attack', accent: 'ember', desc: 'Damage' },
  block: { label: 'Defense', accent: 'azure', desc: 'Block' },
  poison: { label: 'Debuff', accent: 'verdant', desc: 'Poison' },
  weaken: { label: 'Debuff', accent: 'verdant', desc: 'Weaken' },
  strength: { label: 'Buff', accent: 'gold', desc: 'Empower' },
  mana: { label: 'Utility', accent: 'cyan', desc: 'Mana' },
  heal: { label: 'Utility', accent: 'cyan', desc: 'Heal' },
  add: { label: 'Modifier', accent: 'violet', desc: 'Add' },
  multiply: { label: 'Modifier', accent: 'violet', desc: 'Multiply' },
};

export const MAX_JAR = 5;
export const MAX_MANA = 5;
export const REROLL_COST = 1;
export const NUDGE_COST = 2;
export const SHOP_DIE_COST = 22;
export const SHOP_FORGE_COST = 16;
export const SHOP_HEAL_COST = 13;