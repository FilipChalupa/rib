// Local top-5 of the fastest finished games (localStorage; per browser, nothing leaves the device).
const KEY = 'zebirka-scores', NAME_KEY = 'zebirka-name', MAX = 5;

export function loadScores() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(r => r && Number.isFinite(r.time)).sort((a, b) => a.time - b.time).slice(0, MAX) : [];
  } catch (e) { return []; }
}
export function qualifies(time) {
  const list = loadScores();
  return list.length < MAX || time < list[list.length - 1].time;
}
// Returns the saved row so the table can highlight it.
export function addScore(name, time, injuries) {
  const row = { name: (name || '').trim().slice(0, 12) || 'Anonym', time, injuries, date: new Date().toISOString().slice(0, 10), id: Date.now() };
  const list = [...loadScores(), row].sort((a, b) => a.time - b.time).slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(NAME_KEY, row.name); } catch (e) {}
  return row;
}
export function lastName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
