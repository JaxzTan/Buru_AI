/* Sockabus Console — app logic: seed data, state, hash routing, one view function per screen, actions. */
(() => {
'use strict';
const KEY = 'sockabus-proto-v1';
const ROUTES = ['personas','conversations','verify','entities','status','bank','webchat'];
const STAGES = ['Rapport','Bait','Payment request','Stall'];
const BANKS = { MBB: 'Maybank', CIMB: 'CIMB', PBB: 'Public Bank', RHB: 'RHB' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => { const d = new Date(); return d.toTimeString().slice(0,5); };
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const initials = n => n.split(/\s+/).filter(w => !/^(uncle|aunty|auntie|kak|encik|puan)$/i.test(w)).map(w => w[0]).join('').slice(0,2).toUpperCase() || n.slice(0,2).toUpperCase();
const digits = s => (s || '').replace(/\D/g, '');
const groupAcct = d => d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1 $2 $3');
const uid = p => p + '_' + Math.random().toString(36).slice(2, 7);

/* ---------- seed data (all fictitious) ---------- */
function seed() {
  return {
    personas: [
      { id: 'p_17', name: 'Ah Seng', age: 24, loc: 'Klang', occ: 'fresh grad', langs: ['BM','Mandarin'], status: 'active', handle: '@ahseng.wk', created: '26 Oct', backstory: 'Job hunting after diploma, short on rent this month.', wealth: 'RM2k–5k · high tech-savvy', av: 'blue' },
      { id: 'p_18', name: 'Siti Aminah', age: 55, loc: 'Kota Bharu', occ: 'small trader', langs: ['BM','Manglish'], status: 'active', handle: '@kak_siti55', created: '25 Oct', backstory: 'Runs a kuih stall, saving for Hajj.', wealth: 'RM30k–60k · medium tech-savvy', av: 'green' },
      { id: 'p_12', name: 'Uncle Wong', age: 68, loc: 'Ipoh', occ: 'retired', langs: ['Cantonese','EN'], status: 'paused', handle: '@wong_ipoh68', created: '23 Oct', backstory: 'Retired lorry owner, lives alone, trusts phone calls.', wealth: 'RM200k+ · low tech-savvy', av: 'neutral' },
    ],
    convos: [
      { id: 'c_1031', scammer: '@poslaju_resend', personaId: 'p_17', scam: 'parcel', status: 'bot', stage: 1, last: '08:12', msgs: [
        { who: 'scammer', text: 'Your parcel stuck at customs. Need pay RM8.90 redelivery fee.', t: '08:09' },
        { who: 'persona', text: 'eh which parcel ah? i order a lot from shopee lately', t: '08:12' } ] },
      { id: 'c_1027', scammer: '@dr_invest_my', personaId: 'p_18', scam: 'investment', status: 'operator', stage: 2, last: '07:55', msgs: [
        { who: 'scammer', text: 'Kak, guaranteed 30% return in 2 weeks. Many kakak already join.', t: '07:31' },
        { who: 'persona', text: 'betul ke? i ada sikit savings for hajj', t: '07:34' },
        { who: 'scammer', text: 'Deposit USDT to TQ7vR2pLx9sWm3Ke8dHy4Nc6Bf1Ja1u9xKp', t: '07:40' },
        { who: 'operator', text: 'usdt tu apa? anak saya kena tolong', t: '07:55' } ] },
      { id: 'c_1019', scammer: '@kak_lina_loan', personaId: 'p_12', scam: 'loan', status: 'closed', stage: 3, last: 'Yest.', msgs: [
        { who: 'scammer', text: 'Loan approved RM20,000. Processing fee RM200 first.', t: 'Yest.' },
        { who: 'persona', text: 'aiya so fast approve ah? where i pay', t: 'Yest.' } ] },
    ],
    entities: [
      { id: 'e_870', type: 'wallet', bank: 'TRON', value: 'TQ7vR2pLx9sWm3Ke8dHy4Nc6Bf1Ja1u9xKp', scam: 'investment', status: 'unverified', conf: 'medium', sightings: 3, first: '24 Oct, 07:02', convoId: 'c_1027', stageAt: 2, sample: false },
      { id: 'e_866', type: 'phone', bank: '', value: '+60 11-2345 6789', scam: 'impersonation', status: 'unverified', conf: 'medium', sightings: 2, first: '27 Oct, 06:15', convoId: null, stageAt: 2, sample: true },
      { id: 'e_861', type: 'url', bank: '', value: 'poslaju-track.my-parcel.top', scam: 'parcel', status: 'unverified', conf: 'low', sightings: 1, first: '27 Oct, 21:40', convoId: 'c_1031', stageAt: 1, sample: true },
      { id: 'e_840', type: 'wallet', bank: 'TRON', value: 'TXa9mK2pQ7rLs4Wd8Hn3Ve6Bc1Yt5Zu3kWq', scam: 'investment', status: 'verified', conf: 'high', sightings: 4, first: '22 Oct, 10:02', convoId: null, sample: true },
      { id: 'e_833', type: 'phone', bank: '', value: '+60 12-555 0142', scam: 'impersonation', status: 'verified', conf: 'high', sightings: 6, first: '20 Oct, 21:12', convoId: null, sample: true },
      { id: 'e_828', type: 'url', bank: '', value: 'jnt-redeliver.parcel-my.top', scam: 'parcel', status: 'verified', conf: 'high', sightings: 3, first: '19 Oct, 18:05', convoId: null, sample: true },
      { id: 'e_820', type: 'bank_account', bank: 'CIMB', value: '800122334455', scam: 'loan', status: 'verified', conf: 'high', sightings: 2, first: '18 Oct, 10:30', convoId: null, sample: true },
      { id: 'e_811', type: 'handle', bank: '', value: '@vip_signal_my', scam: 'investment', status: 'rejected', conf: 'low', sightings: 1, first: '17 Oct, 16:44', convoId: null, sample: true },
    ],
    pool: 0,
    newPersonaId: null,
    sel: { convo: 'c_1031', entity: null, webPersona: null },
    filters: { personas: 'all', convos: 'all', entType: 'all', entStatus: 'all', q: '' },
    drafts: { web: '', op: '', note: '', bank: { bank: 'MBB', acct: '', amt: '150.00' } },
    telegram: true,
    usedScript: [],
    lastLookup: null,
  };
}
const GEN = [
  { name: 'Mei Ling', age: 62, loc: 'Penang', occ: 'retired clerk', langs: ['Hokkien','EN'], backstory: 'Retired school clerk, widowed, two children in Singapore. Asks her nephew about apps.', wealth: 'RM100k–300k · low tech-savvy', av: 'mustard' },
  { name: 'Encik Hafiz', age: 45, loc: 'Shah Alam', occ: 'lorry driver', langs: ['BM','Manglish'], backstory: 'Drives for a logistics firm, wants side income for his kids’ school fees.', wealth: 'RM10k–30k · medium tech-savvy', av: 'blue' },
  { name: 'Aunty Lily', age: 66, loc: 'Seremban', occ: 'retired nurse', langs: ['Cantonese','EN'], backstory: 'Retired government nurse with pension, active in church WhatsApp groups.', wealth: 'RM150k–250k · low tech-savvy', av: 'green' },
  { name: 'Kak Rohana', age: 58, loc: 'Johor Bahru', occ: 'canteen owner', langs: ['BM','EN'], backstory: 'Runs a school canteen, recently widowed, handles bills alone.', wealth: 'RM40k–80k · low tech-savvy', av: 'neutral' },
];

/* ---------- state ---------- */
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { S = seed(); }
const ui = { generating: false, genError: false, typing: {}, checking: false, toastTimer: null, lastSync: Date.now() };
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} ui.lastSync = Date.now(); }

const persona = id => S.personas.find(p => p.id === id);
const convo = id => S.convos.find(c => c.id === id);
const queue = () => S.entities.filter(e => e.status === 'unverified').sort((a, b) => (a.sample - b.sample) || (S.entities.indexOf(b) - S.entities.indexOf(a)));
const activePersonas = () => S.personas.filter(p => p.status === 'active');

/* ---------- small renderers ---------- */
const TONE = { active: 'success', draft: 'neutral', paused: 'warning', retired: 'neutral', bot: 'info', operator: 'operator', closed: 'neutral', unverified: 'warning', verified: 'success', rejected: 'danger', high: 'success', medium: 'warning', low: 'neutral' };
const badge = (word, tone) => `<span class="badge t-${tone || TONE[word] || 'neutral'}">${esc(word)}</span>`;
const chip = s => `<span class="chip">${esc(s)}</span>`;
const AVC = { mustard: 'background:var(--mustard)', blue: 'background:var(--blue-soft);color:var(--blue)', green: 'background:var(--green-soft);color:var(--green)', neutral: '' };
const av = (p, lg) => `<span class="av${lg ? ' lg' : ''}" style="${AVC[p.av] || ''}" aria-hidden="true">${esc(initials(p.name))}</span>`;
const typeLabel = e => ({ bank_account: 'Bank · ' + e.bank, wallet: 'Wallet · ' + e.bank, phone: 'Phone', url: 'URL', handle: 'Handle' }[e.type]);
const showVal = e => e.type === 'bank_account' ? groupAcct(e.value) : e.type === 'wallet' ? e.value.slice(0,6) + '…' + e.value.slice(-7) : e.value;
const head = (title, sub, right = '') => `<div class="head"><div><h1>${esc(title)}</h1><p>${sub}</p></div>${right}</div>`;

/* ---------- routing (hash = view; real app keeps the same in the URL path + query) ---------- */
const route = () => { const h = location.hash.slice(1); return ROUTES.includes(h) ? h : 'personas'; };
function addrPath(r) {
  const f = S.filters;
  return {
    personas: `/personas?status=${f.personas}${S.newPersonaId ? '&new=' + S.newPersonaId : ''}`,
    conversations: `/conversations/${S.sel.convo || ''}?status=${f.convos}`,
    verify: `/verify?selected=${S.sel.entity || (queue()[0] || {}).id || ''}`,
    entities: `/entities?type=${f.entType}&status=${f.entStatus}${f.q ? '&q=' + encodeURIComponent(f.q) : ''}`,
    status: '/status',
    bank: '/demo/bank',
    webchat: `/demo/chat?persona=${S.sel.webPersona || ''}`,
  }[r];
}

function renderNav(r) {
  const q = queue().length, live = S.convos.filter(c => c.status !== 'closed').length;
  const link = (id, label, count, tid) => `<a href="#${id}" data-testid="nav-${tid || id}" ${r === id ? 'aria-current="page"' : ''}><span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
  document.getElementById('nav-op').innerHTML = link('personas','Personas') + link('conversations','Conversations', live) + link('verify','Verify queue', q) + link('entities','Entities') + link('status','Status');
  document.getElementById('nav-demo').innerHTML = link('bank','Bank simulator') + link('webchat','Web chat');
  const ok = S.telegram;
  document.getElementById('sys').innerHTML = `<div class="row"><span class="dot" style="color:${ok ? 'var(--green)' : 'var(--red)'}"></span>${ok ? 'All systems normal' : 'Telegram disconnected'}</div><small>${ok ? 'Telegram connected · last message <span data-ago></span>' : 'Alert sent to team · use Web chat'}</small>`;
}

function demoSteps() {
  const mei = S.personas.find(p => p.gen);
  const c = mei && S.convos.find(c => c.personaId === mei.id && c.web);
  const e = c && S.entities.find(x => x.convoId === c.id && x.type === 'bank_account');
  const held = S.lastLookup && S.lastLookup.result === 'held';
  return [
    { label: 'Generate persona', done: !!mei, go: 'personas' },
    { label: 'Activate', done: !!mei && mei.status === 'active', go: 'personas' },
    { label: 'Scammer chats', done: !!c && c.msgs.length > 1, go: 'webchat' },
    { label: 'Account captured', done: !!e, go: 'webchat' },
    { label: 'Human verifies', done: !!e && e.status === 'verified', go: 'verify' },
    { label: 'Bank holds transfer', done: held, go: 'bank' },
  ];
}
function renderPath() {
  const steps = demoSteps(); const i = steps.findIndex(s => !s.done);
  const hint = i === -1 ? '<span class="badge t-success">Demo path complete</span>' :
    `<span class="muted">Next:</span> <a class="btn btn-primary btn-sm" href="#${steps[i].go}" data-testid="demo-next">${esc(steps[i].label)} →</a>`;
  document.getElementById('demo-path').innerHTML = `<span class="caps muted">Demo path</span><ol>${steps.map((s, k) => `<li class="${s.done ? 'done' : k === i ? 'now' : ''}"><b>${s.done ? '✓' : k + 1}</b>${esc(s.label)}</li>`).join('')}</ol><div class="next">${hint}</div>`;
}

/* ---------- S1 Personas ---------- */
function vPersonas() {
  const f = S.filters.personas;
  const counts = { all: S.personas.length, active: 0, draft: 0, paused: 0 };
  S.personas.forEach(p => { if (counts[p.status] != null) counts[p.status]++; });
  const list = S.personas.filter(p => f === 'all' || p.status === f);
  const np = S.newPersonaId && persona(S.newPersonaId);
  const genBtn = ui.generating
    ? `<button class="btn btn-primary" disabled data-testid="persona-generate-loading"><span class="spin"></span>Generating… up to 30 s</button>`
    : `<button class="btn btn-primary" data-action="generate" data-testid="persona-generate-btn">+ Generate persona</button>`;
  let banner = '';
  if (ui.genError) banner = `<div class="banner err" data-testid="persona-generate-error"><div class="txt"><h3>Couldn't generate a persona</h3><p>The AI model didn't answer in time. Nothing was saved. Try again — it usually works on the second click.</p></div><div class="acts"><button class="btn btn-primary" data-action="generate">Try again</button></div></div>`;
  else if (np && np.status === 'draft') banner = `<div class="banner" role="status">${av(np, true)}<div class="txt"><h3>New persona ready — ${esc(np.name)}, ${np.age} · ${esc(np.loc)}</h3><p>${esc(np.backstory)} ${esc(np.wealth)} · speaks ${np.langs.join(', ')}.</p><p class="muted">Activating binds ${esc(np.name)} to honeypot <span class="mono">${esc(np.handle)}</span>, so scammers can message right away.</p></div><div class="acts"><button class="btn btn-secondary" data-action="generate">Generate another</button><button class="btn btn-success" data-action="persona-status" data-id="${np.id}" data-to="active" data-testid="persona-activate-btn">Activate now</button></div></div>`;
  else if (np && np.status === 'active' && S.newPersonaId) banner = `<div class="banner" style="background:var(--green-soft);border-color:var(--green)"><div class="txt"><h3>${esc(np.name)} is live on <span class="mono">${esc(np.handle)}</span></h3><p>Next, play the scammer and send her the first message.</p></div><div class="acts"><a class="btn btn-primary" href="#webchat" data-action="pick-web" data-id="${np.id}">Chat as scammer →</a></div></div>`;
  const rows = list.length ? list.map(p => `
    <tr class="${p.id === S.newPersonaId && p.status === 'draft' ? 'hl' : ''}" data-testid="persona-row">
      <td><div class="namecell">${av(p)}<div><b data-testid="persona-name">${esc(p.name)}</b><small>${p.age} · ${esc(p.loc)} · ${esc(p.occ)}</small></div></div></td>
      <td><div class="row-gap">${p.langs.map(chip).join('')}</div></td>
      <td data-testid="persona-status">${badge(p.status)}</td>
      <td class="mono" style="font-size:12px">${esc(p.handle)}</td>
      <td class="muted">${esc(p.created)}</td>
      <td class="right">${p.status === 'active'
        ? `<button class="btn btn-secondary btn-sm" data-action="persona-status" data-id="${p.id}" data-to="paused" data-testid="persona-pause-btn">Pause</button>`
        : `<button class="btn ${p.status === 'draft' ? 'btn-success' : 'btn-secondary'} btn-sm" data-action="persona-status" data-id="${p.id}" data-to="active" data-testid="persona-activate-btn">Activate</button>`}</td>
    </tr>`).join('') : `<tr><td colspan="6"><div class="empty"><b>No ${f} personas</b><span>Generate one, or switch the filter to All.</span></div></td></tr>`;
  return head('Personas', 'Fake victims that scammers believe are real. Only <b>active</b> personas can be reached.', genBtn) + banner +
    `<div class="tabs" role="group" aria-label="Filter by status">${['all','active','draft','paused'].map(k => `<button aria-pressed="${f === k}" data-action="filter" data-key="personas" data-val="${k}">${k[0].toUpperCase() + k.slice(1)} ${counts[k]}</button>`).join('')}</div>
    <div class="tablewrap"><table><thead><tr><th>Name</th><th>Languages</th><th>Status</th><th>Honeypot</th><th>Created</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="foot-note">Generated personas never use real people's names, IDs or photos. Lifecycle: draft → active → paused → retired. Every prompt edit is saved as a new version.</p>`;
}

/* ---------- S2 Conversations ---------- */
function stageBar(c) {
  return `<div class="stages" aria-label="Playbook stage">${STAGES.map((s, i) => {
    const cls = i < c.stage ? 'done' : i === c.stage ? 'now' : '';
    return `<span class="stage ${cls}"><b>${i < c.stage ? '✓' : i + 1}</b>${s}</span>${i < 3 ? `<hr class="${i < c.stage ? 'done' : ''}">` : ''}`;
  }).join('')}</div>`;
}
function entityCard(e) {
  if (e.status === 'verified') return `<div class="ent ok"><div class="txt"><span class="caps" style="color:var(--green)">Verified · ${esc(typeLabel(e))}</span><div class="val"><span class="mono">${esc(showVal(e))}</span>${badge('verified')}${badge('high')}</div><p>Banks checking this account now get a match with high confidence.</p></div><a class="btn btn-secondary btn-sm" href="#bank">Try it in bank simulator →</a></div>`;
  if (e.status === 'rejected') return `<div class="ent no"><div class="txt"><span class="caps muted">Rejected · ${esc(typeLabel(e))}</span><div class="val"><span class="mono">${esc(showVal(e))}</span>${badge('rejected')}</div><p>Kept for the audit trail. Never returned as high confidence.</p></div></div>`;
  return `<div class="ent"><div class="txt"><span class="caps" style="color:var(--amber)">Entity extracted · ${esc(typeLabel(e))} · from this chat</span><div class="val"><span class="mono">${esc(showVal(e))}</span>${badge('unverified')}${badge(e.conf)}<span class="muted" style="font-size:13px">${e.sightings} sighting${e.sightings > 1 ? 's' : ''}</span></div><p>Auto-extraction stops at medium. Verify here or in the queue. No page switch needed.</p></div><div class="row-gap"><button class="btn btn-secondary btn-sm" data-action="decide" data-id="${e.id}" data-to="rejected">Reject</button><button class="btn btn-success btn-sm" data-action="decide" data-id="${e.id}" data-to="verified" data-testid="verify-btn">Verify</button></div></div>`;
}
function msgHtml(m) {
  return `<div class="msg ${m.who}" data-testid="chat-message"><p>${esc(m.text)}</p><small data-testid="chat-message-sender">${m.who} · ${esc(m.t)}</small></div>`;
}
function vConversations() {
  const f = S.filters.convos;
  const list = S.convos.filter(c => f === 'all' || c.status === f);
  if (!convo(S.sel.convo) && S.convos[0]) S.sel.convo = S.convos[0].id;
  const c = convo(S.sel.convo);
  const items = list.length ? list.map(x => { const p = persona(x.personaId); const lm = x.msgs[x.msgs.length - 1]; return `
    <button class="item" data-action="sel-convo" data-id="${x.id}" aria-current="${x.id === S.sel.convo}" data-testid="convo-row">
      <span class="top"><span class="mono">${esc(x.scammer)}</span><span class="muted" style="font-size:13px">${esc(x.last)}</span></span>
      <b>→ ${esc(p ? p.name : '?')}</b>
      <span class="prev">${esc(lm ? lm.text : 'No messages yet')}</span>
      <span class="row-gap">${chip(x.scam)}<span data-testid="convo-status">${badge(x.status === 'operator' ? 'operator' : x.status, x.status === 'bot' ? 'info' : undefined)}</span></span>
    </button>`; }).join('') : `<div class="card empty"><b>Nothing here</b><span>No ${f} conversations right now.</span></div>`;
  let pane = `<div class="card empty" style="min-height:400px;align-content:center"><b>No conversation selected</b><span>Pick one on the left, or start one from Web chat.</span><a class="btn btn-primary" href="#webchat">Open web chat →</a></div>`;
  if (c) {
    const p = persona(c.personaId);
    const ents = S.entities.filter(e => e.convoId === c.id);
    const isOp = c.status === 'operator', closed = c.status === 'closed';
    const msgs = c.msgs.map(msgHtml).join('') + ents.map(entityCard).join('') +
      (ui.typing[c.id] ? `<div class="typing"><span><i></i><i></i><i></i></span>${esc(p.name)} is typing…</div>` : '');
    const footer = closed ? `<div class="chat-f"><span class="txt">Conversation closed. Its entities stay in the intelligence database.</span></div>`
      : isOp ? `<form class="chat-f op" data-form="op"><span class="badge t-operator">You are replying as ${esc(p.name)}</span><div class="composer"><input class="input" id="op-input" name="op" autocomplete="off" placeholder="Type as ${esc(p.name)}…" value="${esc(S.drafts.op)}" data-testid="operator-input" aria-label="Operator message"><button class="btn btn-primary" data-testid="operator-send-btn">Send</button></div><button type="button" class="btn btn-secondary" data-action="handback" data-id="${c.id}">Hand back to bot</button></form>`
      : `<div class="chat-f"><span class="txt">Bot is replying with a 10–30 s human delay. Take over any time. The bot stops instantly.</span><button class="btn btn-secondary" data-action="takeover" data-id="${c.id}" data-testid="takeover-btn">Take over</button></div>`;
    pane = `<section class="card chat" aria-label="Conversation">
      <div class="chat-h">${av(p, true)}<div class="who"><b class="mono">${esc(c.scammer)}</b> <b>→ ${esc(p.name)}, ${p.age} · ${esc(p.loc)}</b><small>${c.web ? 'Web chat' : 'Telegram'} · honeypot ${esc(p.handle)}</small></div>${chip(c.scam)}${badge(isOp ? 'operator' : closed ? 'closed' : 'bot replying', isOp ? 'operator' : closed ? 'neutral' : 'info')}</div>
      ${stageBar(c)}
      <div class="msgs" id="msgs">${msgs}</div>
      ${footer}
    </section>`;
  }
  return head('Conversations', 'Watch personas talk to scammers. Take over any time.', `<span class="live"><span class="dot"></span><span class="caps">Live · updated <span data-ago></span></span></span>`) +
    `<div class="split"><div class="list"><div class="tabs" role="group" aria-label="Filter by status">${[['all','All'],['bot','Bot'],['operator','Operator'],['closed','Closed']].map(([k, l]) => `<button aria-pressed="${f === k}" data-action="filter" data-key="convos" data-val="${k}">${l}</button>`).join('')}</div>${items}</div>${pane}</div>`;
}

/* ---------- S3 Verify ---------- */
function vVerify() {
  const q = queue();
  if (!q.find(e => e.id === S.sel.entity)) S.sel.entity = q[0] ? q[0].id : null;
  const kb = `<span class="live"><span class="muted" style="font-size:13px">Keys:</span><span class="mono" style="font-size:12px">V verify · R reject · J/K next</span></span>`;
  if (!q.length) return head('Verify queue', 'A human confirms every scam account before any bank sees it.', kb) +
    `<div class="card empty" style="padding:48px"><b>Queue clear</b><span>Nothing is waiting for a human. New accounts appear here the moment a scammer sends one.</span><div class="row-gap"><a class="btn btn-secondary" href="#entities">See all entities</a><a class="btn btn-primary" href="#bank">Test in bank simulator →</a></div></div>`;
  const e = q.find(x => x.id === S.sel.entity);
  const c = e.convoId && convo(e.convoId);
  const src = c ? c.msgs.findIndex(m => m.who === 'scammer' && digits(m.text).includes(digits(e.value)) || m.text.includes(e.value)) : -1;
  const lines = c && src > -1 ? c.msgs.slice(Math.max(0, src - 1), src + 1) : [];
  const hl = t => { const v = e.type === 'bank_account' ? null : e.value; if (v && t.includes(v)) return esc(t).replace(esc(v), `<mark>${esc(v)}</mark>`); const m = t.match(/(\d[\d\s-]{8,}\d)/); return m && digits(m[1]) === digits(e.value) ? esc(t).replace(esc(m[1]), `<mark>${esc(m[1])}</mark>`) : esc(t); };
  const checks = [
    [true, 'Sent by the scammer, not the persona'],
    [e.stageAt >= 2, e.stageAt >= 2 ? 'Sent during the Payment request stage' : 'Sent before the Payment request stage — check the context'],
    [true, e.type === 'bank_account' ? `Valid length for a ${BANKS[e.bank] || e.bank} account number` : e.type === 'wallet' ? 'Valid TRON address format' : 'Valid format'],
    [e.sightings > 1, e.sightings > 1 ? `Seen in ${e.sightings} conversations` : 'Seen in only 1 conversation so far — check the excerpt'],
  ];
  const list = q.map(x => `<button class="item" data-action="sel-entity" data-id="${x.id}" aria-current="${x.id === e.id}" data-testid="entity-row">
      <span class="top"><span class="caps muted" style="flex:1">${esc(typeLabel(x))}</span><span class="muted" style="font-size:13px">${esc(x.first)}</span></span>
      <span class="mono" data-testid="entity-value" style="overflow:hidden;text-overflow:ellipsis">${esc(showVal(x))}</span>
      <span class="row-gap">${chip(x.scam)}<span data-testid="entity-confidence">${badge(x.conf)}</span><span class="muted" style="font-size:13px">${x.sightings} sighting${x.sightings > 1 ? 's' : ''}</span>${x.sample ? badge('sample','neutral') : ''}</span>
    </button>`).join('');
  return head('Verify queue', 'A human confirms every scam account before any bank sees it.', kb) +
    `<div class="split-v"><div class="list"><span class="caps muted">${q.length} pending</span>${list}</div>
    <section class="card evi" aria-label="Evidence">
      <div class="row-gap" style="justify-content:space-between"><div><span class="caps muted">${esc(typeLabel(e))}${e.bank && BANKS[e.bank] ? ' (' + esc(BANKS[e.bank]) + ')' : ''}</span><div class="big" style="overflow-wrap:anywhere">${esc(e.type === 'bank_account' ? groupAcct(e.value) : e.value)}</div></div><div class="row-gap">${chip(e.scam)}${badge('unverified')}${badge(e.conf)}</div></div>
      <div class="facts"><div><span class="caps muted">Sightings</span><b>${e.sightings} conversation${e.sightings > 1 ? 's' : ''}</b></div><div><span class="caps muted">First seen</span><b>${esc(e.first)}</b></div><div><span class="caps muted">Source</span><b>${c ? esc(c.scammer) + ' → ' + esc(persona(c.personaId).name) : 'Seed data'}</b></div><div><span class="caps muted">Channel</span><b>${c ? (c.web ? 'Web chat' : 'Telegram') : '—'}</b></div></div>
      <div class="why"><span class="caps muted">Why the system flagged this</span><ul>${checks.map(([ok, t]) => `<li><span class="tick ${ok ? 'y' : 'n'}">${ok ? '✓' : '!'}</span><span>${esc(t)}</span></li>`).join('')}</ul></div>
      ${lines.length ? `<div class="excerpt"><div class="row-gap" style="justify-content:space-between"><span class="caps muted">Source excerpt</span><a class="btn btn-quiet btn-sm" href="#conversations" data-action="sel-convo" data-id="${c.id}">Open full chat →</a></div>${lines.map(m => `<div class="line"><span class="caps ${m.who === 'scammer' ? '' : 'muted'}">${m.who}</span><span>${hl(m.text)}</span></div>`).join('')}</div>` : `<div class="excerpt"><span class="caps muted">Source excerpt</span><span class="muted">Sample entity, no chat attached in this prototype.</span></div>`}
      <div class="field"><label for="note">Note (optional)</label><input class="input" id="note" name="note" placeholder='e.g. "matches job-scam script #2"' value="${esc(S.drafts.note)}"></div>
      <div class="acts-row"><p>After you verify: confidence becomes high, and bank lookups return a match straight away.</p><button class="btn btn-secondary" data-action="decide" data-id="${e.id}" data-to="rejected" data-testid="reject-btn">Reject <span class="kbd">R</span></button><button class="btn btn-success" data-action="decide" data-id="${e.id}" data-to="verified" data-testid="verify-btn">Verify <span class="kbd">V</span></button></div>
    </section></div>`;
}

/* ---------- S4 Entities ---------- */
function vEntities() {
  const f = S.filters;
  const q = f.q.trim().toLowerCase();
  const list = S.entities.filter(e => (f.entType === 'all' || e.type === f.entType) && (f.entStatus === 'all' || e.status === f.entStatus) && (!q || (e.value + ' ' + e.scam + ' ' + e.bank).toLowerCase().includes(q) || digits(e.value).includes(digits(q)) && digits(q).length > 2));
  const opt = (v, cur, l) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`;
  const rows = list.length ? list.map(e => { const c = e.convoId && convo(e.convoId); return `<tr class="${e.status === 'verified' && !e.sample ? 'hl-green' : ''}" data-testid="entity-row">
      <td class="caps muted">${esc(typeLabel(e))}</td>
      <td><div class="row-gap"><span class="mono">${esc(showVal(e))}</span>${e.sample ? badge('sample','neutral') : badge('live','info')}</div></td>
      <td>${chip(e.scam)}</td><td>${badge(e.conf)}</td><td data-testid="entity-status">${badge(e.status)}</td>
      <td class="mono"><b>${e.sightings}</b></td><td class="muted">${esc(e.first)}</td>
      <td class="right">${c ? `<a class="btn btn-quiet btn-sm" href="#conversations" data-action="sel-convo" data-id="${c.id}">View chat →</a>` : '<span class="muted" style="font-size:13px">Seed data</span>'}</td></tr>`; }).join('')
    : `<tr><td colspan="8"><div class="empty"><b>No entities match</b><span>Try another type or status.</span><button class="btn btn-secondary btn-sm" data-action="clear-filters">Clear filters</button></div></td></tr>`;
  const live = S.entities.filter(e => !e.sample).length;
  return head('Entities', 'Every scam account, wallet, number and link we have captured. Each one traces back to its chat.') +
    `<div class="row-gap" style="gap:10px"><div style="flex:1;min-width:220px"><input class="input" id="ent-q" type="search" placeholder="Search account, wallet, phone, URL…" value="${esc(f.q)}" aria-label="Search entities"></div>
      <select class="input" style="width:auto" id="ent-type" data-testid="entity-filter-type" aria-label="Type">${opt('all', f.entType, 'All types')}${opt('bank_account', f.entType, 'Bank account')}${opt('wallet', f.entType, 'Wallet')}${opt('phone', f.entType, 'Phone')}${opt('url', f.entType, 'URL')}${opt('handle', f.entType, 'Handle')}</select>
      <select class="input" style="width:auto" id="ent-status" data-testid="entity-filter-status" aria-label="Status">${opt('all', f.entStatus, 'All statuses')}${opt('unverified', f.entStatus, 'Unverified')}${opt('verified', f.entStatus, 'Verified')}${opt('rejected', f.entStatus, 'Rejected')}</select></div>
    <div class="tablewrap"><table><thead><tr><th>Type</th><th>Value</th><th>Scam type</th><th>Confidence</th><th>Status</th><th>Sightings</th><th>First seen</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="foot-note">${list.length} shown · ${live} live from chats, ${S.entities.length - live} labelled <b>sample</b> (seed data, never real people). Trend chart and CSV export come after v1.0.</p>`;
}

/* ---------- S5 Bank simulator ---------- */
function lookup(bank, acct) {
  const d = digits(acct);
  const e = S.entities.find(x => x.type === 'bank_account' && x.bank === bank && x.value === d);
  if (!e || e.status === 'rejected') return { result: 'sent', res: { match: false }, e: null };
  if (e.status === 'verified') return { result: 'held', e, res: { match: true, confidence: 'high', scam_types: [e.scam], first_seen: e.first, sightings: e.sightings } };
  return { result: 'warn', e, res: { match: true, confidence: e.conf, scam_types: [e.scam], first_seen: e.first, sightings: e.sightings } };
}
function vBank() {
  const d = S.drafts.bank, L = S.lastLookup;
  const captured = S.entities.filter(e => e.type === 'bank_account' && !e.sample).slice(-1)[0];
  let result = '';
  if (ui.checking) result = `<div class="result" style="border-color:var(--line);background:var(--paper)"><div class="rh"><span class="spin"></span><b>Checking recipient with Sockabus…</b></div></div>`;
  else if (L) {
    const e = L.e && S.entities.find(x => x.id === L.e.id);
    if (L.result === 'held') result = `<div class="result held" data-testid="result-held" role="alert"><div class="rh"><span class="ic">!</span><div><h2>Transfer held</h2><p>This account is linked to a <b>${esc(e.scam)}</b> scam. Your RM ${esc(L.amt)} has not left your account.</p></div></div><div class="reasons"><div><span class="caps muted">Confidence</span><b>High · human-verified</b></div><div><span class="caps muted">Scam type</span><b style="text-transform:capitalize">${esc(e.scam)}</b></div><div><span class="caps muted">Seen</span><b>${e.sightings} time${e.sightings > 1 ? 's' : ''}</b></div><div><span class="caps muted">First seen</span><b>${esc(e.first)}</b></div><div><span class="caps muted">Checked in</span><b class="mono">${L.ms} ms</b></div></div><div class="row-gap"><button class="btn btn-secondary" data-action="bank-edit">Edit recipient</button><button class="btn btn-danger" data-action="bank-cancel">Cancel transfer</button></div></div>`;
    else if (L.result === 'warn') result = `<div class="result warn" role="status"><div class="rh"><span class="ic">?</span><div><h2>Check before sending</h2><p>This account was reported in a scam chat, but no analyst has confirmed it yet. Confidence: <b>${esc(e.conf)}</b>.</p></div></div><p class="muted" style="font-size:13px">A bank would usually ask the customer to confirm. Verify it in the queue to see a full hold.</p><div class="row-gap"><a class="btn btn-primary" href="#verify" data-action="sel-entity" data-id="${e.id}">Open in verify queue →</a></div></div>`;
    else result = `<div class="result sent" data-testid="result-sent" role="status"><div class="rh"><span class="ic">✓</span><div><h2>Transfer sent</h2><p>No scam record for this recipient. Checked in <span class="mono">${L.ms} ms</span>, so the customer felt no delay.</p></div></div><div class="row-gap"><button class="btn btn-secondary" data-action="bank-edit">New transfer</button></div></div>`;
  }
  const json = L ? JSON.stringify(L.res, null, 2).replace(/("match": true|"confidence": "high")/g, '<span class="k">$1</span>') : '// press Transfer to see the real response';
  const steps = !L ? [['DemoBank asks Sockabus', 'POST /v1/lookup with bank + account number'], ['Sockabus checks verified intelligence', 'Only human-verified accounts return high confidence'], ['DemoBank decides', 'Hold, warn or send — in well under a second']]
    : L.result === 'held' ? [['DemoBank asked Sockabus', 'POST /v1/lookup · bank account · ' + L.bank], ['Sockabus found a verified record', 'Captured from a scammer chat, confirmed by an operator'], ['DemoBank held the transfer', `Answer in ${L.ms} ms, inside the payment window`]]
    : L.result === 'warn' ? [['DemoBank asked Sockabus', 'POST /v1/lookup · bank account · ' + L.bank], ['Sockabus found an unconfirmed report', 'Extracted automatically, waiting for a human'], ['DemoBank warns the customer', 'Medium confidence never triggers an automatic hold']]
    : [['DemoBank asked Sockabus', 'POST /v1/lookup · bank account · ' + L.bank], ['No record in Sockabus intelligence', 'Never seen in a scammer conversation'], ['DemoBank sent the money', `Answer in ${L.ms} ms, no friction for good customers`]];
  return head('Bank simulator', 'A pretend bank. Its fraud check calls the real Sockabus lookup before money leaves.', badge('Demo only · not a real bank','neutral')) +
    `<div class="bankgrid"><section class="card bank" aria-label="DemoBank transfer">
      <div class="bank-h"><span class="sq">DB</span><b>DemoBank · Online transfer</b><small class="mono">Savings ••• 4410</small></div>
      <form data-form="bank" novalidate>
        <div class="field"><label for="bank-select">Recipient bank</label><select class="input" id="bank-select" name="bank" data-testid="bank-select">${Object.entries(BANKS).map(([k, v]) => `<option value="${k}" ${d.bank === k ? 'selected' : ''}>${v} (${k})</option>`).join('')}</select></div>
        <div class="field"><label for="account-input">Account number</label><input class="input mono" id="account-input" name="acct" inputmode="numeric" autocomplete="off" placeholder="e.g. 5621 0384 11" value="${esc(d.acct)}" data-testid="account-input" required></div>
        <div class="quick"><span>Quick fill:</span>${captured ? `<button type="button" data-action="fill" data-bank="${captured.bank}" data-acct="${captured.value}">Account captured from chat</button>` : ''}<button type="button" data-action="fill" data-bank="CIMB" data-acct="800122334455">Known loan-scam account</button><button type="button" data-action="fill" data-bank="MBB" data-acct="114022018837">Clean account</button></div>
        <div class="field"><label for="amount-input">Amount (RM)</label><input class="input mono" id="amount-input" name="amt" inputmode="decimal" value="${esc(d.amt)}" data-testid="amount-input"></div>
        <button class="btn btn-primary" ${ui.checking ? 'disabled' : ''} data-testid="transfer-btn">Transfer RM ${esc(d.amt || '0.00')}</button>
        <p class="muted" style="margin:0;font-size:13px" id="bank-err">Before sending, DemoBank asks Sockabus: is this recipient linked to a scam?</p>
      </form>${result}</section>
      <aside class="bts" aria-label="Behind the scenes"><span class="caps">Behind the scenes</span><h2>${L ? 'What just happened, in 3 steps' : 'What happens when you press Transfer'}</h2>
        <ol>${steps.map(([a, b], i) => `<li class="${L ? '' : 'off'}"><b class="n">${i + 1}</b><span><b>${esc(a)}</b><small>${esc(b)}</small></span></li>`).join('')}</ol>
        <pre aria-label="Lookup response">${json}</pre>
        <p class="fine">The lookup token stays on our server. The browser never calls /v1/lookup directly.</p></aside></div>`;
}

/* ---------- S6 Status ---------- */
function vStatus() {
  const ok = S.telegram;
  const live = S.convos.filter(c => c.status !== 'closed').length;
  const t = (id, label, big, sub, word, tone, bad) => `<div class="card tile ${bad ? 'bad' : ''}" data-testid="${id}"><div class="th"><span class="caps">${label}</span>${badge(word, tone)}</div><div class="v">${big}</div><small>${sub}</small></div>`;
  return head('Status', 'Proof the honeypot listens 24/7, and that we know within 2 minutes if it stops.', `<button class="btn btn-secondary" data-action="kuma">Open uptime monitor ↗</button>`) +
    `<div class="overall ${ok ? 'ok' : 'bad'}" role="status"><span class="ic">${ok ? '✓' : '!'}</span><div class="txt"><h2>${ok ? 'All systems operational' : 'Degraded: Telegram disconnected'}</h2><span class="muted" style="font-size:13px">${ok ? 'Auto-refresh every 10 s · last checked <span data-ago></span>' : 'Team alerted by Telegram group and email. Demo can continue on Web chat.'}</span></div><button class="btn btn-secondary btn-sm" data-action="toggle-tg">${ok ? 'Simulate: Telegram drops' : 'Simulate: reconnect'}</button></div>
    <div class="tiles">
      ${t('status-telegram', 'Telegram honeypot', ok ? 'Connected' : 'Disconnected', ok ? `${activePersonas().length} accounts active · heartbeat every 60 s` : 'No heartbeat for 2 min · alert sent', ok ? 'up' : 'down', ok ? 'success' : 'danger', !ok)}
      ${t('status-last-message', 'Last message received', ok ? '<span data-ago></span>' : '2 min ago', ok ? 'From the most recent scammer chat' : 'Nothing received since the drop', ok ? 'live' : 'stale', ok ? 'success' : 'warning')}
      ${t('status-llm-errors', 'AI model', '0 errors', 'Gemini · last 15 minutes · fallback: Claude', 'ok', 'success')}
      ${t('status-workflows', 'Conversations running', String(live), 'Capacity 1,000 · none stuck over 2 h', 'running', 'info')}
      ${t('status-api', 'Lookup API', '41 ms', 'Synthetic check every 60 s returns a match as expected', 'up', 'success')}
      ${t('status-health', 'Backend health', '200 OK', 'Database, Redis and Temporal reachable', 'up', 'success')}
    </div>
    <div class="lower"><div class="card uptime"><div class="row-gap" style="justify-content:space-between"><span class="caps muted">Last 24 hours</span><b style="color:var(--green)">99.9% up</b></div><div class="bars" aria-label="Hourly uptime, last 24 hours">${Array.from({ length: 24 }, (_, i) => `<i class="${i === 9 ? 'a' : i === 23 && !ok ? 'r' : ''}" title="${i}:00"></i>`).join('')}</div><span class="muted" style="font-size:13px">One amber hour at 11:00: the bot restarted after a deploy and reconnected in 40 s. Amber means degraded, red means down.</span></div>
    <div class="alerting"><span class="caps">If something stops</span><h3>The team gets a Telegram and email alert within 2 minutes.</h3><p>Last drill: bot stopped on purpose at 15:10, alert arrived in 1 min 38 s, recovery alert on restart.</p></div></div>`;
}

/* ---------- S7 Web chat ---------- */
const SCRIPT = [
  ['Opener', 'Hi Auntie, our company need part-time reviewer. RM300 per day, only click like.'],
  ['Deposit ask', 'Can! First task need deposit RM150 to activate account, after that we return RM450.'],
  ['Send account', 'Maybank 5621 0384 11 name SAMPLE TRADING'],
  ['Push urgency', 'Hurry Auntie, slot closing tonight! Transfer now ok?'],
];
function vWebchat() {
  const act = activePersonas();
  if (!act.find(p => p.id === S.sel.webPersona)) S.sel.webPersona = act[0] ? act[0].id : null;
  const helper = `<aside class="helper"><span class="caps">When to use this page</span><h3>Telegram down on demo day? Open this on a second laptop. Everything else stays the same.</h3><ul><li>Tap a script line to fill the box, so nobody types on stage.</li><li>Watch the reply appear on Conversations. The real persona waits 10–30 s; this prototype waits about 2 s.</li><li>The account you send shows up in the Verify queue.</li><li>Telegram go / no-go: Fri 30 Oct, 12:00.</li></ul></aside>`;
  if (!act.length) return head('Web chat', 'You play the scammer. Same pipeline as Telegram.', badge('Dev only','warning')) + `<div class="wc"><div class="card empty" style="padding:48px"><b>No active personas</b><span>Scammers can only reach active personas. Activate one first.</span><a class="btn btn-primary" href="#personas">Go to Personas →</a></div>${helper}</div>`;
  const p = persona(S.sel.webPersona);
  const c = S.convos.find(x => x.personaId === p.id && x.web);
  const msgs = c ? c.msgs.map(m => `<div class="msg ${m.who === 'scammer' ? 'mine' : 'them'}" data-testid="webchat-message"><p>${esc(m.text)}</p><small>${m.who === 'scammer' ? 'You (scammer) · ' + esc(m.t) + ' · delivered' : esc(p.name) + ' · ' + esc(m.t)}</small></div>`).join('') : `<div class="empty"><b>Start the scam</b><span>Tap "Opener" below, or type your own first message.</span></div>`;
  const typing = c && ui.typing[c.id] ? `<div class="typing"><span><i></i><i></i><i></i></span>${esc(p.name)} is typing…</div>` : '';
  const paused = c && c.status === 'operator' ? `<div class="msg them"><small>An operator has taken over this chat. Replies come from a human.</small></div>` : '';
  return head('Web chat', 'You play the scammer. Same pipeline as Telegram. Used as the demo fallback and by automated tests.', badge('Dev only · NEXT_PUBLIC_DEV_CHAT','warning')) +
    `<div class="wc"><section class="card phone" aria-label="Scammer chat">
      <div class="phone-h">${av(p, true)}<div class="who"><label class="caps" for="wc-persona" style="color:var(--faint)">Talking to</label><select id="wc-persona" data-testid="webchat-persona-select">${act.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)} (active)</option>`).join('')}</select></div>${badge('active')}</div>
      <div class="msgs" id="msgs">${msgs}${paused}${typing}</div>
      <div class="script"><span class="caps muted">Golden script · job scam</span>${SCRIPT.map(([l, t], i) => `<button type="button" class="${S.usedScript.includes(i) ? 'used' : ''}" data-action="script" data-i="${i}">${S.usedScript.includes(i) ? '✓ ' : ''}${i + 1} ${esc(l)}</button>`).join('')}</div>
      <form data-form="web"><input class="input" id="webchat-input" name="web" autocomplete="off" placeholder="Type as the scammer…" value="${esc(S.drafts.web)}" data-testid="webchat-input" aria-label="Scammer message"><button class="btn btn-primary" data-testid="webchat-send-btn">Send</button></form>
    </section>${helper}</div>`;
}

/* ---------- logic: extraction, classification, persona replies ---------- */
function classify(t) {
  t = t.toLowerCase();
  if (/parcel|poslaju|customs|redeliver|j&t/.test(t)) return 'parcel';
  if (/invest|return|usdt|crypto|profit/.test(t)) return 'investment';
  if (/loan|pinjaman|approved/.test(t)) return 'loan';
  if (/part-time|reviewer|job|task|commission|click like/.test(t)) return 'job';
  if (/police|polis|bank negara|lhdn|court|mahkamah/.test(t)) return 'impersonation';
  if (/love|dear|sayang|darling/.test(t)) return 'romance';
  return null;
}
function extract(text) {
  const out = []; const low = text.toLowerCase();
  const acct = text.match(/\b(\d[\d\s-]{8,18}\d)\b/);
  if (acct && !/^\+?60/.test(acct[1].trim())) {
    const d = digits(acct[1]);
    if (d.length >= 10 && d.length <= 16) {
      const bank = /cimb/.test(low) ? 'CIMB' : /public bank|pbb/.test(low) ? 'PBB' : /rhb/.test(low) ? 'RHB' : 'MBB';
      out.push({ type: 'bank_account', bank, value: d });
    }
  }
  const w = text.match(/\bT[1-9A-HJ-NP-Za-km-z]{33}\b/); if (w) out.push({ type: 'wallet', bank: 'TRON', value: w[0] });
  const ph = text.match(/\+?60\s?1\d[\s-]?\d{3,4}[\s-]?\d{4}/); if (ph) out.push({ type: 'phone', bank: '', value: ph[0] });
  const u = text.match(/\b[a-z0-9-]+(\.[a-z0-9-]+)+\.(top|xyz|com|my|net|info)(\/\S*)?/i); if (u && !/@/.test(u[0])) out.push({ type: 'url', bank: '', value: u[0] });
  return out;
}
function personaReply(c, text, hasEntity) {
  const t = text.toLowerCase();
  if (hasEntity) return ['ok wait ah, my nephew help me do the transfer tonight. the name must write exactly like that?', 3];
  if (/bot|robot|\bai\b|chatgpt/.test(t)) return ['haiya what bot, i auntie la. my grandson also say i type very slow', c.stage];
  if (/deposit|pay|transfer|fee|bank in|activate/.test(t)) return ['ok la i try.. which bank ah? i use maybank app', Math.max(c.stage, 2)];
  if (/rm\s?\d|job|part-time|return|profit|loan/.test(t)) return ['wah really ah? i retired already, can do from home or not?', Math.max(c.stage, 1)];
  if (/hurry|fast|cepat|tonight|now/.test(t)) return ['aiyo dont rush me la, i old already slow slow one', c.stage];
  return ['sorry ah i not so understand, can explain again?', c.stage];
}
function scammerSends(text) {
  const p = persona(S.sel.webPersona); if (!p) return;
  let c = S.convos.find(x => x.personaId === p.id && x.web);
  if (!c) { c = { id: 'c_' + (1040 + S.convos.length), scammer: '@hr_parttime_job', personaId: p.id, scam: 'other', status: 'bot', stage: 0, last: now(), msgs: [], web: true }; S.convos.unshift(c); }
  c.msgs.push({ who: 'scammer', text, t: now() }); c.last = now();
  const k = classify(text); if (k && c.scam === 'other') c.scam = k;
  const found = extract(text); let newEnt = false;
  found.forEach(f => {
    let e = S.entities.find(x => x.type === f.type && x.bank === f.bank && x.value === f.value);
    if (e) { e.sightings++; if (!e.convoId) e.convoId = c.id; }
    else { e = { id: uid('e'), ...f, scam: c.scam === 'other' ? (k || 'other') : c.scam, status: 'unverified', conf: 'medium', sightings: 1, first: today() + ', ' + now(), convoId: c.id, stageAt: Math.max(c.stage, 2), sample: false }; S.entities.push(e); newEnt = true; S.sel.entity = e.id; }
  });
  if (/deposit|pay|transfer|fee|bank in/.test(text.toLowerCase())) c.stage = Math.max(c.stage, 2);
  S.sel.convo = c.id; save(); render();
  if (newEnt) toast('Entity extracted · now in the Verify queue', 'Open', '#verify');
  if (c.status !== 'bot') return;
  ui.typing[c.id] = true; render();
  setTimeout(() => {
    ui.typing[c.id] = false;
    if (c.status !== 'bot') { render(); return; }
    const [reply, stage] = personaReply(c, text, found.some(f => f.type === 'bank_account' || f.type === 'wallet'));
    c.msgs.push({ who: 'persona', text: reply, t: now() }); c.stage = stage; c.last = now();
    save(); render();
  }, 1600 + Math.random() * 1200);
}

/* ---------- toast ---------- */
function toast(msg, actLabel, href, onAct) {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('data-testid', 'verify-toast');
  el.innerHTML = `<span class="ok">✓</span><span>${esc(msg)}</span>` + (actLabel ? `<button type="button">${esc(actLabel)}</button>` : '');
  const box = document.getElementById('toasts'); box.appendChild(el);
  if (actLabel) el.querySelector('button').onclick = () => { if (onAct) onAct(); if (href) location.hash = href; el.remove(); };
  setTimeout(() => el.remove(), 6000);
}

/* ---------- actions ---------- */
function decide(id, to) {
  const e = S.entities.find(x => x.id === id); if (!e) return;
  const prev = { status: e.status, conf: e.conf };
  e.status = to; e.conf = to === 'verified' ? 'high' : 'low'; e.note = S.drafts.note; S.drafts.note = '';
  save(); render();
  toast(`${to === 'verified' ? 'Verified' : 'Rejected'} ${typeLabel(e)} ${showVal(e)}${to === 'verified' ? ' — now high' : ''}`, 'Undo', null, () => { e.status = prev.status; e.conf = prev.conf; save(); render(); });
}
const ACT = {
  generate() {
    ui.generating = true; ui.genError = false; render();
    setTimeout(() => {
      ui.generating = false;
      const g = GEN[S.pool % GEN.length]; S.pool++;
      const handle = '@' + g.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 9) + g.age;
      const p = { id: 'p_' + (40 + S.pool), ...g, status: 'draft', handle, created: 'just now', gen: true };
      S.personas.unshift(p); S.newPersonaId = p.id; S.filters.personas = 'all'; save(); render();
    }, 1800);
  },
  'persona-status'(el) { const p = persona(el.dataset.id); if (!p) return; p.status = el.dataset.to; if (p.status === 'active') S.sel.webPersona = p.id; save(); render(); toast(`${p.name} is ${p.status}`); },
  'pick-web'(el) { S.sel.webPersona = el.dataset.id; save(); },
  filter(el) { S.filters[el.dataset.key] = el.dataset.val; save(); render(); },
  'clear-filters'() { Object.assign(S.filters, { entType: 'all', entStatus: 'all', q: '' }); save(); render(); },
  'sel-convo'(el) { S.sel.convo = el.dataset.id; save(); if (route() === 'conversations') render(); },
  'sel-entity'(el) { S.sel.entity = el.dataset.id; save(); if (route() === 'verify') render(); },
  takeover(el) { const c = convo(el.dataset.id); c.status = 'operator'; ui.typing[c.id] = false; save(); render(); const i = document.getElementById('op-input'); if (i) i.focus(); },
  handback(el) { const c = convo(el.dataset.id); c.status = 'bot'; save(); render(); toast('Bot is replying again'); },
  decide(el) { decide(el.dataset.id, el.dataset.to); },
  script(el) { const i = +el.dataset.i; S.drafts.web = SCRIPT[i][1]; if (!S.usedScript.includes(i)) S.usedScript.push(i); save(); render(); const inp = document.getElementById('webchat-input'); if (inp) inp.focus(); },
  fill(el) { S.drafts.bank.bank = el.dataset.bank; S.drafts.bank.acct = groupAcct(el.dataset.acct); S.lastLookup = null; save(); render(); },
  'bank-edit'() { S.lastLookup = null; save(); render(); const i = document.getElementById('account-input'); if (i) i.focus(); },
  'bank-cancel'() { S.drafts.bank.acct = ''; S.lastLookup = { ...S.lastLookup, cancelled: true }; save(); toast('Transfer cancelled. Money stayed with the customer'); },
  'toggle-tg'() { S.telegram = !S.telegram; save(); render(); toast(S.telegram ? 'Telegram reconnected · recovery alert sent' : 'Alert sent to team Telegram group and email'); },
  kuma() { toast('In the real app this opens status.sockabus.my (Uptime Kuma)'); },
  reset() { S = seed(); ui.typing = {}; save(); location.hash = 'personas'; render(); toast('Demo data reset'); },
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]'); if (!el) return;
  const a = ACT[el.dataset.action]; if (!a) return;
  if (el.tagName !== 'A') ev.preventDefault();
  a(el);
});
document.addEventListener('submit', ev => {
  const f = ev.target.closest('form[data-form]'); if (!f) return; ev.preventDefault();
  const kind = f.dataset.form;
  if (kind === 'web') { const t = S.drafts.web.trim(); if (!t) return; S.drafts.web = ''; scammerSends(t); setTimeout(() => { const i = document.getElementById('webchat-input'); if (i) i.focus(); }, 0); }
  if (kind === 'op') { const t = S.drafts.op.trim(); if (!t) return; const c = convo(S.sel.convo); c.msgs.push({ who: 'operator', text: t, t: now() }); c.last = now(); S.drafts.op = ''; save(); render(); const i = document.getElementById('op-input'); if (i) i.focus(); }
  if (kind === 'bank') {
    const d = S.drafts.bank; const n = digits(d.acct);
    const err = document.getElementById('bank-err');
    if (n.length < 10) { err.textContent = 'Enter the full account number (at least 10 digits).'; err.style.color = 'var(--red)'; document.getElementById('account-input').focus(); return; }
    ui.checking = true; render();
    const t0 = performance.now();
    setTimeout(() => { const r = lookup(d.bank, d.acct); ui.checking = false; S.lastLookup = { ...r, bank: d.bank, amt: d.amt, ms: r.result === 'sent' ? 18 : 41, t: Math.round(performance.now() - t0) }; save(); render(); }, 650);
  }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'webchat-input') S.drafts.web = t.value;
  else if (t.id === 'op-input') S.drafts.op = t.value;
  else if (t.id === 'note') S.drafts.note = t.value;
  else if (t.id === 'account-input') S.drafts.bank.acct = t.value;
  else if (t.id === 'amount-input') S.drafts.bank.amt = t.value;
  else if (t.id === 'ent-q') { S.filters.q = t.value; save(); const pos = t.selectionStart; render(); const n = document.getElementById('ent-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'bank-select') { S.drafts.bank.bank = t.value; S.lastLookup = null; save(); render(); }
  if (t.id === 'amount-input') { const v = parseFloat(t.value.replace(/[^\d.]/g, '')); S.drafts.bank.amt = isNaN(v) ? '0.00' : v.toFixed(2); save(); render(); }
  if (t.id === 'ent-type') { S.filters.entType = t.value; save(); render(); }
  if (t.id === 'ent-status') { S.filters.entStatus = t.value; save(); render(); }
  if (t.id === 'wc-persona') { S.sel.webPersona = t.value; save(); render(); }
});
document.addEventListener('keydown', ev => {
  if (route() !== 'verify' || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const q = queue(); if (!q.length) return;
  const i = Math.max(0, q.findIndex(e => e.id === S.sel.entity)); const k = ev.key.toLowerCase();
  if (k === 'v') decide(q[i].id, 'verified');
  else if (k === 'r') decide(q[i].id, 'rejected');
  else if (k === 'j' || k === 'arrowdown') { S.sel.entity = q[Math.min(q.length - 1, i + 1)].id; save(); render(); }
  else if (k === 'k' || k === 'arrowup') { S.sel.entity = q[Math.max(0, i - 1)].id; save(); render(); }
  else return;
  ev.preventDefault();
});

/* ---------- render ---------- */
const VIEWS = { personas: vPersonas, conversations: vConversations, verify: vVerify, entities: vEntities, status: vStatus, bank: vBank, webchat: vWebchat };
let lastRoute = null;
function render() {
  const r = route();
  const main = document.getElementById('main');
  const msgsBefore = document.getElementById('msgs');
  const stick = msgsBefore ? msgsBefore.scrollHeight - msgsBefore.scrollTop - msgsBefore.clientHeight < 60 : true;
  const active = document.activeElement && document.activeElement.id;
  main.innerHTML = VIEWS[r]();
  renderNav(r); renderPath();
  document.getElementById('addr-path').textContent = addrPath(r);
  const msgs = document.getElementById('msgs'); if (msgs && (stick || r !== lastRoute)) msgs.scrollTop = msgs.scrollHeight;
  if (active && r === lastRoute) { const n = document.getElementById(active); if (n && n.tagName === 'INPUT') { n.focus(); const v = n.value; try { n.setSelectionRange(v.length, v.length); } catch (e) {} } }
  lastRoute = r; tick();
}
function tick() {
  const s = Math.max(1, Math.round((Date.now() - ui.lastSync) / 1000));
  document.querySelectorAll('[data-ago]').forEach(n => n.textContent = s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago');
}
setInterval(() => { if (Date.now() - ui.lastSync > 10000) ui.lastSync = Date.now() - 2000; tick(); }, 1000);
window.addEventListener('hashchange', () => { render(); document.getElementById('main').focus({ preventScroll: true }); window.scrollTo(0, 0); });
render();
})();
