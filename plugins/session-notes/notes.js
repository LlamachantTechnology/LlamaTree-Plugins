'use strict';

// Session notes: a page of notes per session, kept by the app for this plugin (getData / setData), so a compaction or
// a new conversation can't lose them. You read and edit them here. With "keep" on for a session, its agent is asked (by
// message) to save notes here as it works ("save: …") and can ask for them back ("read"); for a Claude session the
// plugin also sends them back by itself once its conversation has been compacted (it sees that in "activity"). It runs
// in the background ("background": true), so it answers while its tab isn't open.

const $ = (id) => document.getElementById(id);
const pending = new Map();
let nextRequest = 1;

/** A request to the app; resolves with its result, or rejects with the reason it was refused. */
function request(name, args = {}) {
  const requestId = nextRequest++;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    parent.postMessage({ type: 'llamatree:request', requestId, name, ...args }, '*');
  });
}

/** The address sessions message it by (the app's relay names a plugin "plugin:" and its id). */
const ME = 'plugin:session-notes';

const KEEP = `This is the Session notes plugin in LlamaTree. Its id for send_message is "${ME}". Please keep notes for this session there, so they outlast a compaction or a new conversation: whenever a piece of work is finished, a decision is made or the task changes, send it a message that starts with "save:" followed by the note, in a sentence or two. A save gets no answer, so carry on after sending one. Send it "read" to get the notes back. After your conversation is compacted they are also sent to you. Start by saving a note of where things stand now.`;
const STOP = 'You no longer need to keep notes with the Session notes plugin. The notes saved so far stay there.';
const HELP = 'I keep this session\'s notes. Send "save: <note>" to add one, or "read" to get them back.';

/** What it keeps: { v, sessions: { [sessionId]: { name, text, keep, updated } } }, text being Markdown. */
let data = { v: 1, sessions: {} };
let sessions = [];          // the sessions it sees ("sessions")
let shown = null;           // the session whose notes are on the page
let dirty = false;          // the page's text differs from what's kept

const entry = (id) => (data.sessions[id] ??= { name: sessions.find((s) => s.id === id)?.name ?? id, text: '', keep: false, updated: null });

let writing = Promise.resolve();
/** Saves what it keeps through the app, one save after another. */
function persist() {
  writing = writing.then(() => request('setData', { data })).catch((e) => status(e.message));
  return writing;
}

const status = (text) => { $('status').textContent = text ?? ''; };
const stamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const add = (text, note) => (text.trim() ? text.replace(/\s*$/, '\n') : '') + `- ${note.replace(/\s*\n\s*/g, ' ')} (${stamp()})`;

// ---------------------------------------------------------------- the page

function render() {
  const e = shown ? data.sessions[shown] : null;
  $('text').value = e?.text ?? '';
  $('text').disabled = !shown;
  $('keep').checked = !!e?.keep;
  $('keep').disabled = !shown;
  $('save').disabled = true;
  $('saved').textContent = e?.updated ? `Saved ${e.updated}` : '';
  dirty = false;
}

/** The sessions it sees, in the picker: `want` if given, else the open session (unless you're editing), else the one shown. */
async function loadSessions(want = null) {
  try { sessions = await request('sessions'); } catch (e) { status(e.message); return; }
  const open = sessions.find((s) => s.open)?.id;
  const pick = want ?? (dirty ? shown : open ?? shown) ?? sessions[0]?.id ?? null;
  $('session').replaceChildren(...sessions.map((s) => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.name}${s.project ? ` · ${s.project}` : ''}${data.sessions[s.id]?.keep ? ' ✎' : ''}`;
    return o;
  }));
  if (!sessions.length) status('It sees no sessions. Permissions › By plugin chooses its projects.');
  if (pick && pick !== shown) { if (dirty) await saveText(); shown = pick; render(); }
  if (shown) $('session').value = shown;
}

async function saveText() {
  if (!shown) return;
  const e = entry(shown);
  e.text = $('text').value;
  e.updated = stamp();
  dirty = false;
  $('save').disabled = true;
  $('saved').textContent = `Saved ${e.updated}`;
  await persist();
}

/** Turns keeping notes on or off for the shown session, telling its agent by message. */
async function setKeep(on) {
  if (!shown) return;
  const e = entry(shown);
  e.keep = on;
  await persist();
  try {
    const r = await request('sendMessage', { to: shown, text: on ? KEEP : STOP, replyTo: null });
    status(r.outcome === 'denied' ? 'It may not message that session: Permissions › By plugin chooses its projects.'
      : on ? `Asked ${e.name} to keep notes here. Its agent reads the message once it's idle.` : `Told ${e.name} it no longer needs to keep notes.`);
  } catch (err) { status(err.message); }
  loadSessions();
}

// ---------------------------------------------------------------- the agents' messages

/**
 * Answers what sessions sent: "save: …" adds a note to the sender's, "read" sends them back, anything else says how. A
 * save gets no answer: each answer is a message the agent is prompted to read, a turn of its own spent on "saved".
 */
async function readMessages() {
  let messages;
  try { messages = await request('readMessages'); } catch (e) { status(e.message); return; }
  for (const m of messages) {
    const text = (m.text ?? '').trim();
    const e = entry(m.from);
    if (m.fromName) e.name = m.fromName;
    const save = /^(?:save|note)\s*:\s*/i.exec(text);
    let reply;
    if (save) {
      const note = text.slice(save[0].length).trim();
      if (!note) reply = 'Nothing was saved: put the note after "save:".';
      else {
        e.text = add(e.text, note);
        e.updated = stamp();
        await persist();
        if (m.from === shown && !dirty) render();
      }
    } else if (/^read\b/i.test(text)) reply = e.text.trim() ? `This session's notes:\n\n${e.text.trim()}` : 'This session has no notes yet.';
    else reply = HELP;
    if (!reply) continue;
    try { await request('sendMessage', { to: m.from, text: reply, replyTo: m.id }); } catch (err) { status(err.message); }
  }
}

// ---------------------------------------------------------------- after a compaction

// What it has read of each kept session's activity: { conversation, version } (to ask only for what's new).
const have = {};

/**
 * For each session keeping notes: when its conversation has been compacted since last time, sends its notes back. The
 * first look at a conversation only learns where it is, so nothing is sent for compactions from before. Activity is
 * read from Claude's transcript, so this is for Claude sessions; other agents are asked to "read" after a compaction.
 */
async function watch() {
  const ids = Object.keys(data.sessions).filter((id) => data.sessions[id].keep && sessions.some((s) => s.id === id));
  if (!ids.length) return;
  let found;
  try { found = await request('activity', { ids, have }); } catch { return; }
  for (const a of found ?? []) {
    if (!a.found) continue;
    const first = have[a.id]?.conversation !== a.conversation;
    have[a.id] = { conversation: a.conversation, version: a.version };
    if (first || !a.events?.some((ev) => ev.k === 'compact')) continue;
    const e = data.sessions[a.id];
    if (!e?.text.trim()) continue;
    try {
      await request('sendMessage', { to: a.id, text: `Your conversation has just been compacted. These are your session notes from before it:\n\n${e.text.trim()}`, replyTo: null });
    } catch (err) { status(err.message); }
  }
}

// ---------------------------------------------------------------- the app's theme

const THEME_COLORS = { bg: 'chrome', panel: 'panel', border: 'border', text: 'text', dim: 'text-dim', accent: 'accent-strong' };

function dress(m) {
  const root = document.documentElement, c = m.colors ?? {};
  root.dataset.theme = m.theme === 'light' ? 'light' : 'dark';
  for (const [mine, theirs] of Object.entries(THEME_COLORS)) { if (c[theirs]) root.style.setProperty('--' + mine, c[theirs]); else root.style.removeProperty('--' + mine); }
  document.body.style.fontFamily = m.font ? `"${m.font}", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif` : '';
}

addEventListener('message', (e) => {
  if (e.source !== parent) return;
  const m = e.data;
  if (m?.type === 'llamatree:response') {
    const p = pending.get(m.requestId);
    if (!p) return;
    pending.delete(m.requestId);
    if ('error' in m) p.reject(new Error(m.error)); else p.resolve(m.result);
  } else if (m?.type === 'llamatree:theme') dress(m);
  else if (m?.type === 'llamatree:message') readMessages();
  else if (m?.type === 'llamatree:command' && m.command === 'show' && m.context?.sessionId) loadSessions(m.context.sessionId);
});

dress({ theme: new URLSearchParams(location.search).get('theme') });
$('text').addEventListener('input', () => { dirty = true; $('save').disabled = false; $('saved').textContent = 'Not saved'; });
$('text').addEventListener('keydown', (e) => { if (e.key === 's' && e.ctrlKey) { e.preventDefault(); saveText(); } });
$('save').addEventListener('click', saveText);
$('keep').addEventListener('change', () => setKeep($('keep').checked));
$('refresh').addEventListener('click', () => loadSessions());
$('session').addEventListener('change', async () => { if (dirty) await saveText(); shown = $('session').value; render(); });

(async () => {
  try { const kept = await request('getData'); if (kept?.sessions) data = kept; } catch (e) { status(e.message); }
  await loadSessions();
  await readMessages();
  setInterval(() => { if (!dirty) loadSessions(); }, 5000);   // follows the session you open
  setInterval(watch, 15000);
  watch();
})();
