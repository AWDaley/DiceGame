/** Called only on reducer-owned drafts. Events are data first, readable text second. */
export function emit(state, type, actorId, data = {}, text = '') {
  state.events.push({ id: ++state.eventCounter, type, actorId, round: state.combat?.roundNumber || 0,
    exchangeId: state.combat?.exchangeId || 0, data, text });
  if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
}
