import { EQUIPMENT, MANEUVERS, ATTRIBUTES, LOADOUT_CAP, ENCOUNTERS, SHOP_ITEM_COST, SHOP_FORGE_COST, SHOP_HEAL_COST, SHOP_REFILL_COST } from './content.js';
import { itemDefinition, validateLoadout } from './equipment.js';
import { esc, buttonData, heading, faces } from './ui-utils.js';

export function itemCard(item, extra = '') {
  const d = itemDefinition(item);
  return `<article class="gear-card"><div class="gear-top"><span class="gear-icon">${d.icon}</span><span class="eyebrow">${esc(d.category)}</span>${item.charges!==null?`<span class="charge-label">${item.charges}/${d.charges} charges</span>`:''}</div><h3>${d.name}</h3>${faces(item)}<div class="gear-moves">${d.maneuvers.map(mid=>{
    const m=MANEUVERS[mid];return `<div><strong>${m.name} <small>${m.timing}</small></strong><span>${ATTRIBUTES[m.attribute].name} · ${m.manaCost} mana · ${m.recoveryRounds} extra recovery${m.accuracy?` · Accuracy ${m.accuracy}`:''}</span><p>${m.description}</p></div>`;
  }).join('')}</div>${d.maneuvers.length>1?'<p class="shared-warning">These maneuvers share one item and recovery timer.</p>':''}${extra}</article>`;
}
export function renderLoadout(state) {
  const h=state.combatants.hero, equipped=h.equippedItemIds, reason=validateLoadout(h), encounter=ENCOUNTERS[state.encounter];
  const section=(items)=>`<div class="gear-grid">${items.map(item=>{
    const selected=equipped.includes(item.id);
    return itemCard(item,`<button class="${selected?'ghost-button':'primary-button'} equip-button" ${buttonData(state,'equip',{'item-id':item.id})} aria-pressed="${selected}" ${!selected&&equipped.length>=LOADOUT_CAP?'disabled':''}>${selected?'UNEQUIP':'EQUIP'} ${esc(itemDefinition(item).name)}</button>`);
  }).join('')}</div>`;
  return `${heading('01 / EQUIPMENT', 'Pack for the <em>next fight.</em>', 'Equip up to eight items. Keep a Focus Crystal and a repeatable offensive weapon or spell. Swap only between encounters.')}
    <div class="loadout-banner"><div><strong>${equipped.length} / ${LOADOUT_CAP} equipped</strong><p>${encounter.name}: ${encounter.tendency}</p>${reason?`<p class="warning">${esc(reason)}</p>`:''}</div><button class="primary-button" ${buttonData(state,'begin-battle')} ${reason?'disabled':''}>ENTER BATTLE <span>→</span></button></div>
    <h2 class="subheading">Equipped <small>available during combat</small></h2>${section(h.items.filter(i=>equipped.includes(i.id)))}
    <h2 class="subheading">Backpack <small>unequip an item to make room</small></h2>${section(h.items.filter(i=>!equipped.includes(i.id)))}`;
}
function offerCard(state, type, shop) {
  const d=EQUIPMENT[type], sold=state.shopSold.includes(type), item={definitionId:type,faces:d.faces,charges:d.charges??null};
  return itemCard(item,`<button class="primary-button equip-button" ${buttonData(state,shop?'buy':'claim',{'definition-id':type})} ${shop&&(sold||state.gold<SHOP_ITEM_COST)?'disabled':''}>${shop?(sold?'SOLD':`BUY · ${SHOP_ITEM_COST} GOLD`):'TAKE EQUIPMENT'}</button>`);
}
export function renderRewards(state) {
  return `${heading('VICTORY / REWARD','Choose your <em>reward.</em>','Take equipment, recover health, or improve one face. New equipment goes into your backpack.')}
    <div class="gear-grid">${state.rewardOffers.map(type=>offerCard(state,type,false)).join('')}</div>
    <div class="reward-extras"><button class="ghost-button" ${buttonData(state,'rest')}>REST · restore up to 14 HP</button><button class="ghost-button" ${buttonData(state,'forge-start')}>FORGE · improve one face free</button></div>`;
}
export function renderShop(state) {
  const h=state.combatants.hero;
  return `${heading('BETWEEN ENCOUNTERS / SHOP','Provision your <em>journey.</em>',`You have ${state.gold} gold. Potion and venom charges do not reset between fights.`)}
    <div class="gear-grid">${state.shopOffers.map(type=>offerCard(state,type,true)).join('')}</div><div class="shop-services">
    <button class="ghost-button" ${buttonData(state,'shop-heal')} ${state.gold<SHOP_HEAL_COST||h.hp===h.maxHp?'disabled':''}>HEAL 12 HP · ${SHOP_HEAL_COST} gold</button>
    <button class="ghost-button" ${buttonData(state,'forge-start')} ${state.gold<SHOP_FORGE_COST?'disabled':''}>FORGE A FACE · ${SHOP_FORGE_COST} gold</button>
    ${h.items.filter(i=>i.charges!==null).map(i=>`<button class="ghost-button" ${buttonData(state,'refill',{'item-id':i.id})} ${i.charges>=itemDefinition(i).charges||state.gold<SHOP_REFILL_COST?'disabled':''}>REFILL ${itemDefinition(i).name} (${i.charges}/${itemDefinition(i).charges}) · ${SHOP_REFILL_COST} gold</button>`).join('')}</div>
    <div class="cast-footer"><p class="muted">Your stats, upgraded faces, remaining HP and charges carry forward.</p><button class="primary-button" ${buttonData(state,'next-encounter')}>PREPARE NEXT ENCOUNTER <span>→</span></button></div>`;
}
export function renderForge(state) {
  return `${heading('EQUIPMENT FORGE','Engrave your <em>next advantage.</em>',`Improve one face for ${state.forgeCost} gold. All maneuvers on that physical item share its faces. Maximum face value: 12.`)}
    <div class="forge-inventory">${state.combatants.hero.items.map(item=>`<div class="forge-row"><div class="forge-ident"><span class="forge-symbol">${itemDefinition(item).icon}</span><div><strong>${itemDefinition(item).name}</strong><span>${itemDefinition(item).maneuvers.map(id=>MANEUVERS[id].name).join(' / ')}</span></div></div><div class="forge-faces">${item.faces.map((face,index)=>`<button ${buttonData(state,'upgrade-face',{'item-id':item.id,'face-index':index})} aria-label="Upgrade face ${index+1} of ${itemDefinition(item).name}" ${face>=12?'disabled':''}><span>${face}</span><small>+1</small></button>`).join('')}</div></div>`).join('')}</div><button class="ghost-button" ${buttonData(state,'forge-cancel')}>← BACK WITHOUT UPGRADING</button>`;
}
