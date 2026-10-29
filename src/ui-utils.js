export function esc(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
export function buttonData(state, action, data = {}) {
  return Object.entries({ action, revision: state.revision, exchange: state.combat?.exchangeId || 0, ...data })
    .map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ');
}
export function heading(marker, title, text) {
  return `<div class="section-heading"><div class="section-heading__copy"><span class="eyebrow accent-eyebrow">${esc(marker)}</span><h1>${title}</h1><p>${esc(text)}</p></div></div>`;
}
export function faces(item) { return `<div class="mini-faces" aria-label="Faces ${item.faces.join(', ')}">${item.faces.map(n=>`<span>${n}</span>`).join('')}</div>`; }
