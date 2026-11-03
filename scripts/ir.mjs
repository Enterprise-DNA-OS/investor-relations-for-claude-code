#!/usr/bin/env node
// The one CLI for Investor Relations for Claude Code. Human tables by default, --json for machines.
//   npm run ir -- help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

const pct = (col) => `to_char(${col} / 100.0, 'FM990.00') || '%'`;
const dollars = (col) => `case when ${col} is null then null else '$' || to_char(${col} / 100.0, 'FM990.00') end`;

// Every read the IR team, the CFO and the CEO ask for, by name.
export const reads = {
  settings: 'select key,value,unit,note from settings order by key',
  team: 'select code,name,role,active from team order by code',
  institutions: 'select code,name,kind,style,city,country,aum_m,tier,status,owner from v_holders order by tier,name',
  contacts: 'select c.code,c.name,i.code institution,c.role,c.email,c.phone,c.city from contacts c left join institutions i on i.id=c.institution_id where c.active order by i.code,c.name',
  holders: `select rank,code,name,kind,style,to_char(shares,'FM999,999,999,990') shares,${pct('pct_bps')} pct,to_char(change,'FMS999,999,999,990') change,owner,last_met,days_since_met,next_meeting from v_holders where shares>0 order by rank`,
  movers: `select code,name,move,to_char(prev_shares,'FM999,999,999,990') before,to_char(shares,'FM999,999,999,990') now,${pct('prev_pct_bps')} pct_before,${pct('pct_bps')} pct_now,last_met,met_in_90d_before from v_movers order by change`,
  quiet: `select code,name,kind,rank,${pct('pct_bps')} pct,owner,last_met,days_since_met from v_quiet order by pct_bps desc`,
  targets: "select code,name,kind,style,city,tier,owner,meetings_12m,last_met,next_meeting,note from v_targets order by tier,meetings_12m desc,name",
  upcoming: "select code,held_on,starts,kind,institution,team,contacts,material,coalesce(blackout,'') blackout from v_meetings where status='booked' and held_on>=current_date order by held_on,starts",
  meetings: "select code,held_on,kind,status,institution,team,sentiment,themes,case when status='held' and noted_on is null then 'no notes' else '' end notes from v_meetings where held_on>current_date-90 order by held_on desc,starts desc",
  'notes-due': "select code,held_on,current_date-held_on days,kind,institution,team from v_meetings where status='held' and noted_on is null order by held_on",
  'follow-ups': "select code,due_on,days_over,institution,owner,action,meeting from v_follow_ups where done_on is null order by due_on",
  coverage: `select code,broker,analyst,rating,${dollars('target_cents')} target,upside_pct,eps_fy1_cents,eps_fy2_cents,updated_on,days_old from v_coverage order by updated_on desc`,
  consensus: `select brokers,buy,hold,sell,${dollars('price_cents')} price,${dollars('target_cents')} consensus_target,${dollars('low_cents')} low,${dollars('high_cents')} high,upside_pct,eps_fy1_cents,eps_fy2_cents,last_moved from v_consensus`,
  calendar: "select code,kind,title,period_end,on_date,due_by,lodged_on,notice_sent_on,notice_days,blackout,days_away from v_calendar order by on_date",
  blackouts: 'select event,title,starts_on,ends_on,case when current_date between starts_on and ends_on then \'now\' when starts_on>current_date then \'coming\' else \'past\' end state from v_blackouts order by starts_on',
  'exec-time': 'select code,name,role,meetings,five_pct_plus,one_to_five_pct,under_one_pct,not_holding from v_exec_time',
  feedback: 'select event,title,on_date,meetings,positive,neutral,negative,themes from v_feedback',
  themes: 'select theme,times,investors,negative,last_raised from v_themes',
  roadshows: "select r.code,r.name,r.city,r.starts_on,r.ends_on,r.purpose,r.host_broker,(select count(*) from meetings m where m.roadshow_id=r.id and m.status<>'cancelled')::int meetings from roadshows r order by r.starts_on desc",
  materials: "select mt.code,mt.title,mt.released_on,mt.announcement_ref,(select count(*) from meetings m where m.material_id=mt.id and m.status<>'cancelled')::int meetings,(select min(m.held_on) from meetings m where m.material_id=mt.id and m.status<>'cancelled') first_shown from materials mt order by mt.code",
  notices: `select i.code institution,i.name,n.lodged_on,n.kind,to_char(n.shares,'FM999,999,999,990') shares,${pct("round(n.shares*10000.0/shares_on_issue(n.lodged_on))")} pct,n.ref from notices n join institutions i on i.id=n.institution_id order by n.lodged_on desc`,
  aliases: 'select a.alias,i.code institution from institution_aliases a join institutions i on i.id=a.institution_id order by i.code,a.alias',
  compliance: 'select rule,record,issue from v_compliance order by rule,record',
  attention: 'select kind,record,due,detail from v_attention order by due nulls last,kind,record',
};

const named = {
  team: { by: 'code', names: true }, institutions: { by: 'code', names: true }, contacts: { by: 'code', names: true },
  meetings: { by: 'code' }, follow_ups: { by: 'code', names: 'action' }, roadshows: { by: 'code', names: true },
  materials: { by: 'code', names: 'title' }, events: { by: 'code', names: 'title' }, coverage: { by: 'code', names: 'broker' },
};

// Exact code or id first, then a unique prefix or name match. Ambiguity lists candidates.
export async function resolve(db, entity, value) {
  const label = entity.replace(/_/g, ' ').replace(/s$/, '');
  if (!value || value === true) throw Error(`Supply a ${label} code, name or id prefix`);
  const { by, names } = named[entity];
  const nameCol = names === true ? 'name' : names;
  const exact = await db.query(`select * from ${entity} where lower(${by})=lower($1) or id::text=$1${nameCol ? ` or lower(${nameCol})=lower($1)` : ''}`, [String(value)]);
  if (exact.length === 1) return exact[0];
  const found = await db.query(`select * from ${entity} where starts_with(lower(${by}),lower($1)) or starts_with(id::text,$1)${nameCol ? ` or position(lower($1) in lower(${nameCol}))>0` : ''} order by ${by}`, [String(value)]);
  if (found.length === 1) return found[0];
  const list = found.map((r) => `${r[by]}${nameCol ? ' ' + r[nameCol] : ''}`).join('; ') || '(none)';
  throw Error(`${found.length ? 'Ambiguous' : 'No matching'} ${label}: ${value}. Candidates: ${list}`);
}

const required = (v, n) => { if (v === undefined || v === null || v === true || String(v).trim() === '') throw Error(`Required: ${n}`); return String(v).trim(); };
const number = (v, n, { positive = false, min } = {}) => {
  const x = Number(String(required(v, n)).replace(/[$,]/g, ''));
  if (!Number.isFinite(x) || (positive && x <= 0) || (min !== undefined && x < min)) throw Error(`Invalid ${n}: ${v}`);
  return x;
};
const whole = (v, n) => { const x = number(v, n, { min: 0 }); if (!Number.isInteger(x)) throw Error(`Invalid ${n}: ${v} (a whole number)`); return x; };
const cents = (v, n) => Math.round(number(v, n, { positive: true }) * 100);
const date = (v, n = 'date') => {
  const s = required(v, n);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw Error(`Invalid ${n}: use a real YYYY-MM-DD date`);
  return s;
};
const time = (v) => { if (!v) return null; const s = String(v); if (!/^\d{2}:\d{2}$/.test(s) || Number(s.slice(0, 2)) > 23 || Number(s.slice(3)) > 59) throw Error(`Invalid start: ${s}. Use HH:MM`); return s; };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const ymd = (d) => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10);
const list = (v) => (v && v !== true ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : []);
const meetingKinds = ['one-on-one', 'group', 'call', 'conference', 'site visit', 'email'];
const institutionKinds = ['institution', 'super fund', 'hedge fund', 'family office', 'index fund', 'broker', 'retail group', 'other'];
const eventKinds = ['half-year results', 'full-year results', 'quarterly', 'agm', 'investor day', 'dividend', 'other'];

async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const out = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return out; }
  catch (e) { await db.exec('rollback'); throw e; }
}

async function nextCode(db, tbl, prefix, start) {
  const r = await db.query(`select greatest(max(substring(code from ${prefix.length + 1})::int),$2) n from ${tbl} where code ~ $1`, [`^${prefix}[0-9]+$`, start]);
  return `${prefix}${Number(r[0].n) + 1}`;
}

// What would stop a meeting: a blackout window, or material not yet released to the market.
async function meetingProblems(db, day, materialId) {
  const out = [];
  const b = await db.query('select event,title from v_blackouts where $1::date between starts_on and ends_on', [day]);
  if (b.length) out.push(`inside the ${b[0].event} blackout`);
  if (materialId) {
    const m = (await db.query('select code,released_on from materials where id=$1', [materialId]))[0];
    if (!m.released_on || ymd(m.released_on) > day) out.push(`${m.code} is not released to the market ${m.released_on ? 'until ' + ymd(m.released_on) : 'yet'}`);
  }
  return out;
}

const entities = ['settings', 'team', 'institutions', 'institution_aliases', 'contacts', 'capital', 'registers', 'holdings', 'notices', 'roadshows', 'materials', 'events', 'meetings', 'meeting_team', 'meeting_contacts', 'follow_ups', 'coverage', 'prices', 'notes'];

export const help = [
  ...Object.keys(reads),
  'investor <code|name>', 'meeting <code>', 'roadshow <code|name>',
  'add team <code> <name> [--role=..]',
  'add institution <code> <name> [--kind=institution|super fund|hedge fund|family office|index fund|broker|retail group|other] [--style=..] [--city=..] [--country=..] [--aum=millions] [--tier=1-3] [--owner=team]',
  'add contact <code> <name> --institution=.. [--role=..] [--email=..] [--phone=..] [--city=..]',
  'add roadshow <code> <name> --city=.. --from=YYYY-MM-DD --to=YYYY-MM-DD [--purpose=results|non-deal|capital raise] [--broker=..]',
  'add material <code> <title> [--released=YYYY-MM-DD --ref=..]',
  'add event <code> <title> --kind=half-year results|full-year results|quarterly|agm|investor day|dividend|other --date=YYYY-MM-DD [--period-end=YYYY-MM-DD] [--blackout]',
  'add coverage <code> <broker> --rating=buy|hold|sell|not rated [--analyst=..] [--target=2.85] [--eps1=cents] [--eps2=cents] [--date=YYYY-MM-DD]',
  'alias <institution> "<name as it appears on the register>"',
  'meet <institution> --date=YYYY-MM-DD [--kind=one-on-one] [--start=HH:MM] [--team=HM,RP] [--contacts=C01,..] [--roadshow=..] [--material=..] [--city=..] [--force]',
  'note <meeting> --notes="what was discussed" [--sentiment=positive|neutral|negative] [--themes="margins,guidance"]',
  'cancel <meeting> --reason=..',
  'follow-up <meeting> <action> [--owner=team] [--due=YYYY-MM-DD]', 'done <follow-up> [--date=YYYY-MM-DD]',
  'release <material> [--date=YYYY-MM-DD] [--ref=announcement]', 'lodge <event> [--date=YYYY-MM-DD]', 'notice-sent <event> [--date=YYYY-MM-DD]',
  'notice <institution> became|change|ceased --shares=n [--date=YYYY-MM-DD] [--ref=..]',
  'rate <coverage> [--rating=..] [--target=2.85] [--eps1=cents] [--eps2=cents] [--date=YYYY-MM-DD]',
  'price <close, e.g. 2.28> [--date=YYYY-MM-DD]', 'capital <shares on issue> [--date=YYYY-MM-DD]',
  'setting <key> <value>', 'log <institution> <note>',
  'import register <file.csv> --date=YYYY-MM-DD [--top] [--dry-run]',
  'import irwin <folder> [--dry-run] [--map=file.json]', 'export <folder>',
  'draft-briefing <institution>', 'draft-thank-you <meeting>', 'draft-itinerary <roadshow>', 'draft-board-report',
];

export async function run(db, args) {
  const flags = {}; const pos = [];
  for (const a of args) {
    if (a.startsWith('--')) { const i = a.indexOf('='); flags[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1); }
    else pos.push(a);
  }
  const [cmd = 'help', ...a] = pos;
  if (cmd === 'help') return help.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'investor') {
    const i = await resolve(db, 'institutions', a.join(' ') || undefined);
    return {
      investor: await db.query(`select code,name,kind,style,city,country,aum_m,tier,owner,rank,to_char(shares,'FM999,999,999,990') shares,${pct('pct_bps')} pct,to_char(change,'FMS999,999,999,990') change_since_last_register,last_met,meetings_12m,next_meeting from v_holders where institution_id=$1`, [i.id]),
      holdings: await db.query(`select h.as_at,to_char(h.shares,'FM999,999,999,990') shares,${pct('round(h.shares*10000.0/shares_on_issue(h.as_at))')} pct from holdings h where h.institution_id=$1 order by h.as_at`, [i.id]),
      notices: await db.query(`select lodged_on,kind,to_char(shares,'FM999,999,999,990') shares,ref from notices where institution_id=$1 order by lodged_on`, [i.id]),
      contacts: await db.query('select code,name,role,email,phone from contacts where institution_id=$1 and active order by name', [i.id]),
      meetings: await db.query('select code,held_on,kind,status,team,contacts,sentiment,themes,notes from v_meetings where institution_id=$1 order by held_on desc limit 10', [i.id]),
      follow_ups: await db.query('select code,due_on,owner,action,done_on from v_follow_ups where institution=$1 order by due_on', [i.code]),
      notes: await db.query('select created_at,body from notes where institution_id=$1 order by created_at', [i.id]),
    };
  }
  if (cmd === 'meeting') {
    const m = await resolve(db, 'meetings', a[0]);
    return {
      meeting: await db.query('select code,held_on,starts,kind,status,institution,institution_name,team,contacts,roadshow,material,city,sentiment,themes,notes,noted_on,blackout,material_unreleased from v_meetings where meeting_id=$1', [m.id]),
      follow_ups: await db.query('select f.code,f.due_on,t.code owner,f.action,f.done_on from follow_ups f left join team t on t.id=f.owner_id where f.meeting_id=$1 order by f.due_on', [m.id]),
    };
  }
  if (cmd === 'roadshow') {
    const r = await resolve(db, 'roadshows', a.join(' ') || undefined);
    return {
      roadshow: await db.query('select code,name,city,starts_on,ends_on,purpose,host_broker from roadshows where id=$1', [r.id]),
      meetings: await db.query("select code,held_on,starts,kind,status,institution,institution_name,team,contacts,material,coalesce(blackout,'') blackout from v_meetings where meeting_id in (select id from meetings where roadshow_id=$1) order by held_on,starts", [r.id]),
      also_in_city: await db.query(`select h.code,h.name,${pct('h.pct_bps')} pct,h.last_met,case when h.shares>0 then 'holder' else 'target' end standing from v_holders h join institutions i on i.id=h.institution_id where i.status='active' and i.kind not in ('broker','index fund','retail group') and position(lower(i.city) in lower($1))>0 and not exists (select 1 from meetings m where m.institution_id=i.id and m.roadshow_id=$2) order by h.pct_bps desc,h.tier`, [r.city, r.id]),
    };
  }

  if (cmd === 'export') {
    const dir = path.resolve(required(a[0], 'export folder'));
    fs.mkdirSync(dir, { recursive: true });
    return transaction(db, async () => {
      await db.exec('set transaction isolation level repeatable read');
      const counts = [];
      for (const t of entities) {
        const order = { settings: 'key', capital: 'as_at', registers: 'as_at', prices: 'on_date', institution_aliases: 'alias', meeting_team: 'meeting_id,team_id', meeting_contacts: 'meeting_id,contact_id' }[t] || 'id';
        const rows = await db.query(`select * from ${t} order by ${order}`);
        fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2) + '\n');
        counts.push({ entity: t, rows: rows.length });
      }
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, at: new Date().toISOString(), counts }, null, 2) + '\n');
      return counts;
    });
  }

  if (cmd === 'import') {
    if (a[0] === 'register') return importRegister(db, a, flags);
    if (a[0] === 'irwin') return importIrwin(db, a, flags);
    throw Error('Supported imports: register (your share registry CSV) and irwin. See docs/replace-irwin.md');
  }
  if (cmd === 'add') return transaction(db, () => add(db, a, flags));

  if (cmd === 'alias') return transaction(db, async () => {
    const i = await resolve(db, 'institutions', a[0]);
    const alias = required(a.slice(1).join(' '), 'the holder name as it appears on the register').toUpperCase();
    return db.query('insert into institution_aliases(alias,institution_id) values($1,$2) on conflict(alias) do update set institution_id=excluded.institution_id returning alias', [alias, i.id]);
  });

  if (cmd === 'meet') return transaction(db, async () => {
    const i = await resolve(db, 'institutions', a.join(' ') || undefined);
    const day = date(flags.date || today());
    const kind = flags.kind ? String(flags.kind) : 'one-on-one';
    if (!meetingKinds.includes(kind)) throw Error(`Invalid kind: ${kind}. Use ${meetingKinds.join(', ')}`);
    const roadshow = flags.roadshow ? await resolve(db, 'roadshows', flags.roadshow) : null;
    const material = flags.material ? await resolve(db, 'materials', flags.material) : null;
    const problems = await meetingProblems(db, day, material?.id);
    if (problems.length && !flags.force) throw Error(`Not booked: ${problems.join('; ')}. Fix these, or add --force once the disclosure officer has said yes`);
    const code = await nextCode(db, 'meetings', 'M', 2000);
    const m = (await db.query('insert into meetings(code,held_on,starts,kind,institution_id,roadshow_id,material_id,city,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id',
      [code, day, time(flags.start), kind, i.id, roadshow?.id || null, material?.id || null, flags.city || null, day < today() ? 'held' : 'booked']))[0];
    for (const t of list(flags.team)) await db.query('insert into meeting_team(meeting_id,team_id) values($1,$2) on conflict do nothing', [m.id, (await resolve(db, 'team', t)).id]);
    for (const c of list(flags.contacts)) {
      const contact = await resolve(db, 'contacts', c);
      if (contact.institution_id && contact.institution_id !== i.id) throw Error(`${contact.name} is not at ${i.name}`);
      await db.query('insert into meeting_contacts(meeting_id,contact_id) values($1,$2) on conflict do nothing', [m.id, contact.id]);
    }
    return db.query('select code,held_on,starts,kind,status,institution,team,contacts,material,blackout from v_meetings where meeting_id=$1', [m.id]);
  });

  if (cmd === 'note') return transaction(db, async () => {
    const m = await resolve(db, 'meetings', a[0]);
    if (m.status === 'cancelled') throw Error(`Meeting ${m.code} was cancelled`);
    if (ymd(m.held_on) > today()) throw Error(`Meeting ${m.code} is on ${ymd(m.held_on)}: write the notes after it happens`);
    if (m.noted_on) throw Error(`Meeting ${m.code} was noted on ${ymd(m.noted_on)}. Meeting records are not rewritten: add to the investor's file with log instead`);
    const sentiment = flags.sentiment ? String(flags.sentiment) : null;
    if (sentiment && !['positive', 'neutral', 'negative'].includes(sentiment)) throw Error(`Invalid sentiment: ${sentiment}. Use positive, neutral or negative`);
    return db.query("update meetings set status='held',notes=$2,sentiment=$3,themes=$4,noted_on=current_date where id=$1 returning code,status,sentiment,array_to_string(themes,', ') themes,noted_on",
      [m.id, required(flags.notes, 'notes (--notes="what was asked and what was said")'), sentiment, list(flags.themes).map((x) => x.toLowerCase())]);
  });

  if (cmd === 'cancel') return transaction(db, async () => {
    const m = await resolve(db, 'meetings', a[0]);
    if (m.status !== 'booked') throw Error(`Meeting ${m.code} is ${m.status}: only a booked meeting can be cancelled`);
    return db.query("update meetings set status='cancelled',cancel_reason=$2 where id=$1 returning code,status,cancel_reason", [m.id, required(flags.reason, 'reason (--reason=..)')]);
  });

  if (cmd === 'follow-up') return transaction(db, async () => {
    const m = await resolve(db, 'meetings', a[0]);
    const owner = flags.owner ? await resolve(db, 'team', flags.owner) : null;
    const due = flags.due ? date(flags.due, 'due date') : addDays(today(), Number((await db.query("select setting('follow_up_days') d"))[0].d));
    const code = await nextCode(db, 'follow_ups', 'FU', 200);
    await db.query('insert into follow_ups(code,meeting_id,institution_id,owner_id,action,due_on) values($1,$2,$3,$4,$5,$6)', [code, m.id, m.institution_id, owner?.id || null, required(a.slice(1).join(' '), 'action'), due]);
    return db.query('select code,due_on,institution,owner,action,meeting from v_follow_ups where code=$1', [code]);
  });
  if (cmd === 'done') return transaction(db, async () => {
    const f = await resolve(db, 'follow_ups', a[0]);
    if (f.done_on) throw Error(`Follow-up ${f.code} was done on ${ymd(f.done_on)}`);
    return db.query('update follow_ups set done_on=$2 where id=$1 returning code,action,done_on', [f.id, flags.date ? date(flags.date) : today()]);
  });

  if (cmd === 'release') return transaction(db, async () => {
    const m = await resolve(db, 'materials', a.join(' ') || undefined);
    if (m.released_on) throw Error(`${m.code} was released on ${ymd(m.released_on)}`);
    return db.query('update materials set released_on=$2,announcement_ref=coalesce($3,announcement_ref) where id=$1 returning code,title,released_on,announcement_ref', [m.id, flags.date ? date(flags.date) : today(), flags.ref || null]);
  });
  if (cmd === 'lodge' || cmd === 'notice-sent') return transaction(db, async () => {
    const e = await resolve(db, 'events', a.join(' ') || undefined);
    const on = flags.date ? date(flags.date) : today();
    if (cmd === 'notice-sent') {
      if (e.kind !== 'agm') throw Error(`${e.code} is a ${e.kind}: notice-sent is for the AGM`);
      return db.query('update events set notice_sent_on=$2 where id=$1 returning code,title,notice_sent_on,on_date', [e.id, on]);
    }
    if (e.lodged_on) throw Error(`${e.code} was lodged on ${ymd(e.lodged_on)}`);
    return db.query('update events set lodged_on=$2 where id=$1 returning code,title,lodged_on', [e.id, on]);
  });

  if (cmd === 'notice') return transaction(db, async () => {
    const i = await resolve(db, 'institutions', a[0]);
    const kind = required(a[1], 'became, change or ceased');
    if (!['became', 'change', 'ceased'].includes(kind)) throw Error(`Invalid notice: ${kind}. Use became, change or ceased`);
    await db.query('insert into notices(institution_id,lodged_on,kind,shares,ref) values($1,$2,$3,$4,$5)', [i.id, flags.date ? date(flags.date) : today(), kind, whole(flags.shares, 'shares (--shares)'), flags.ref || '']);
    return db.query(reads.notices.replace('order by', 'where i.id=$1 order by'), [i.id]);
  });

  if (cmd === 'rate') return transaction(db, async () => {
    const c = await resolve(db, 'coverage', a.join(' ') || undefined);
    if (flags.rating && !['buy', 'hold', 'sell', 'not rated'].includes(flags.rating)) throw Error(`Invalid rating: ${flags.rating}`);
    return db.query(`update coverage set rating=coalesce($2,rating),target_cents=coalesce($3,target_cents),eps_fy1_cents=coalesce($4,eps_fy1_cents),eps_fy2_cents=coalesce($5,eps_fy2_cents),updated_on=$6 where id=$1 returning code,broker,rating,${dollars('target_cents')} target,eps_fy1_cents,eps_fy2_cents,updated_on`,
      [c.id, flags.rating || null, flags.target ? cents(flags.target, 'target') : null, flags.eps1 ? number(flags.eps1, 'eps1') : null, flags.eps2 ? number(flags.eps2, 'eps2') : null, flags.date ? date(flags.date) : today()]);
  });
  if (cmd === 'price') return transaction(db, () => db.query(`insert into prices(on_date,close_cents) values($1,$2) on conflict(on_date) do update set close_cents=excluded.close_cents returning on_date,${dollars('close_cents')} close`,
    [flags.date ? date(flags.date) : today(), cents(a[0], 'closing price')]));
  if (cmd === 'capital') return transaction(db, () => db.query("insert into capital(as_at,shares_on_issue) values($1,$2) on conflict(as_at) do update set shares_on_issue=excluded.shares_on_issue returning as_at,to_char(shares_on_issue,'FM999,999,999,990') shares_on_issue",
    [flags.date ? date(flags.date) : today(), whole(a[0], 'shares on issue')]));

  if (cmd === 'setting') return transaction(db, async () => {
    const key = required(a[0], 'key');
    const rows = await db.query('update settings set value=$2 where key=$1 returning key,value,unit,note', [key, number(a[1], 'value', { min: 0 })]);
    if (!rows.length) throw Error(`No setting ${key}. Settings: ${(await db.query('select key from settings order by key')).map((r) => r.key).join(', ')}`);
    return rows;
  });
  if (cmd === 'log') return transaction(db, async () => {
    const i = await resolve(db, 'institutions', a[0]);
    return db.query('insert into notes(institution_id,body) values($1,$2) returning created_at,body', [i.id, required(a.slice(1).join(' '), 'note')]);
  });

  if (cmd.startsWith('draft-')) return draft(db, cmd, a.join(' '));
  throw Error(`Unknown command: ${cmd}. Run help`);
}

async function add(db, a, flags) {
  const [what, code, ...rest] = a;
  const name = rest.join(' ');
  if (what === 'team') {
    return db.query('insert into team(code,name,role) values($1,$2,$3) returning code,name,role', [required(code, 'code').toUpperCase(), required(name, 'name'), flags.role || '']);
  }
  if (what === 'institution') {
    const kind = flags.kind || 'institution';
    if (!institutionKinds.includes(kind)) throw Error(`Invalid kind: ${kind}. Use ${institutionKinds.join(', ')}`);
    const owner = flags.owner ? await resolve(db, 'team', flags.owner) : null;
    const tier = flags.tier ? whole(flags.tier, 'tier') : 2;
    if (tier < 1 || tier > 3) throw Error('Invalid tier: 1, 2 or 3');
    return db.query('insert into institutions(code,name,kind,style,city,country,aum_m,tier,owner_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning code,name,kind,tier',
      [required(code, 'code').toUpperCase(), required(name, 'name'), kind, flags.style || '', flags.city || null, flags.country || null, flags.aum ? number(flags.aum, 'aum', { min: 0 }) : null, tier, owner?.id || null]);
  }
  if (what === 'contact') {
    const i = await resolve(db, 'institutions', required(flags.institution, 'institution (--institution)'));
    return db.query('insert into contacts(code,name,institution_id,role,email,phone,city) values($1,$2,$3,$4,$5,$6,$7) returning code,name,role',
      [required(code, 'code').toUpperCase(), required(name, 'name'), i.id, flags.role || '', flags.email || null, flags.phone || null, flags.city || null]);
  }
  if (what === 'roadshow') {
    const from = date(flags.from, 'from'); const to = date(flags.to || flags.from, 'to');
    if (to < from) throw Error('The roadshow ends before it starts');
    return db.query('insert into roadshows(code,name,city,starts_on,ends_on,purpose,host_broker) values($1,$2,$3,$4,$5,$6,$7) returning code,name,city,starts_on,ends_on',
      [required(code, 'code').toUpperCase(), required(name, 'name'), required(flags.city, 'city (--city)'), from, to, flags.purpose || 'non-deal', flags.broker || null]);
  }
  if (what === 'material') {
    return db.query('insert into materials(code,title,released_on,announcement_ref) values($1,$2,$3,$4) returning code,title,released_on',
      [required(code, 'code').toUpperCase(), required(name, 'title'), flags.released ? date(flags.released, 'released') : null, flags.ref || null]);
  }
  if (what === 'event') {
    const kind = required(flags.kind, 'kind (--kind)');
    if (!eventKinds.includes(kind)) throw Error(`Invalid kind: ${kind}. Use ${eventKinds.join(', ')}`);
    return db.query('insert into events(code,kind,title,period_end,on_date,blackout) values($1,$2,$3,$4,$5,$6) returning code,kind,title,period_end,on_date,blackout',
      [required(code, 'code').toUpperCase(), kind, required(name, 'title'), flags['period-end'] ? date(flags['period-end'], 'period end') : null, date(flags.date), Boolean(flags.blackout)]);
  }
  if (what === 'coverage') {
    const rating = required(flags.rating, 'rating (--rating)');
    if (!['buy', 'hold', 'sell', 'not rated'].includes(rating)) throw Error(`Invalid rating: ${rating}`);
    return db.query(`insert into coverage(code,broker,analyst,rating,target_cents,eps_fy1_cents,eps_fy2_cents,updated_on) values($1,$2,$3,$4,$5,$6,$7,$8) returning code,broker,rating,${dollars('target_cents')} target`,
      [required(code, 'code').toUpperCase(), required(name, 'broker'), flags.analyst || '', rating, flags.target ? cents(flags.target, 'target') : null,
        flags.eps1 ? number(flags.eps1, 'eps1') : null, flags.eps2 ? number(flags.eps2, 'eps2') : null, flags.date ? date(flags.date) : today()]);
  }
  throw Error('add team|institution|contact|roadshow|material|event|coverage');
}

// A register or beneficial ownership file: one row per holder line, summed per institution.
async function importRegister(db, a, flags) {
  const file = path.resolve(required(a[1], 'register CSV file'));
  const asAt = date(flags.date, 'register date (--date)');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw Error(`Empty file: ${file}`);
  return transaction(db, async () => {
    const totals = new Map(); const unmatched = [];
    for (const [n, row] of rows.entries()) {
      const holder = required(pick(row, 'Holder name', 'Registered holder', 'Holder', 'Name', 'Investor', 'Beneficial owner', 'Institution'), `row ${n + 2}: holder name`).trim();
      const shares = whole(String(pick(row, 'Units', 'Shares', 'Holding', 'Balance', 'Shares held', 'Position')).replace(/,/g, ''), `row ${n + 2} ${holder}: shares`);
      const match = await db.query('select i.id,i.code from institutions i left join institution_aliases a on a.institution_id=i.id where upper(a.alias)=upper($1) or lower(i.name)=lower($1) or lower(i.code)=lower($1) limit 2', [holder]);
      const ids = [...new Set(match.map((m) => m.id))];
      if (ids.length !== 1) { unmatched.push({ holder, shares }); continue; }
      totals.set(ids[0], (totals.get(ids[0]) || 0) + shares);
    }
    await db.query("insert into registers(as_at,source,note) values($1,'registry',$2) on conflict(as_at) do update set note=excluded.note", [asAt, `Imported from ${path.basename(file)}`]);
    await db.query('delete from holdings where as_at=$1', [asAt]);
    for (const [id, shares] of totals) await db.query('insert into holdings(as_at,institution_id,shares) values($1,$2,$3)', [asAt, id, shares]);
    // A top-holders report does not list everyone: --top carries a missing holder forward from the
    // register before, rather than reading its absence as a sale. The output names each one.
    const carried = flags.top ? await db.query(`insert into holdings(as_at,institution_id,shares)
      select $1,h.institution_id,h.shares from holdings h
      where h.as_at=(select max(as_at) from registers where as_at<$1) and h.shares>0
        and not exists (select 1 from holdings x where x.as_at=$1 and x.institution_id=h.institution_id)
      returning institution_id,shares`, [asAt]) : [];
    const out = [{ register: asAt, lines: rows.length, institutions: totals.size, carried_forward: carried.length, unmatched_lines: unmatched.length, dry_run: Boolean(flags['dry-run']) }];
    const result = { result: out };
    if (carried.length) result.carried_forward = await db.query(`select i.code,i.name,to_char(h.shares,'FM999,999,999,990') shares from holdings h join institutions i on i.id=h.institution_id where h.as_at=$1 and h.institution_id=any($2::uuid[]) order by h.shares desc`, [asAt, carried.map((c) => c.institution_id)]);
    if (unmatched.length) result.unmatched = unmatched.sort((x, y) => y.shares - x.shares).slice(0, 25);
    return Object.keys(result).length > 1 ? result : out;
  }, Boolean(flags['dry-run']));
}

// Irwin does not publish an export layout. These are the column names its CRM screens use; --map
// points any other header at ours: {"institutions": {"name": "Firm"}, "contacts": {...}, "meetings": {...}}.
const irwinFiles = [
  { match: /^(organi[sz]ations?|institutions?|firms?|accounts?)/, entity: 'institutions' },
  { match: /^(contacts?|people|investors?)/, entity: 'contacts' },
  { match: /^(activities|activity|meetings?|interactions?|events?)/, entity: 'meetings' },
];

const codeFrom = (name, len = 4) => name.replace(/&/g, ' ').split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter((w) => w && !/^(the|of|and|ltd|limited|inc|llc|pty|plc)$/i.test(w)).map((w) => w[0]).join('').toUpperCase().slice(0, len) || 'X';

async function uniqueCode(db, tbl, base) {
  let code = base; let n = 1;
  while ((await db.query(`select 1 from ${tbl} where code=$1`, [code])).length) code = `${base}${++n}`;
  return code;
}

async function importIrwin(db, a, flags) {
  const dir = path.resolve(required(a[1], 'folder of Irwin CSV exports'));
  const mapping = flags.map ? JSON.parse(fs.readFileSync(flags.map, 'utf8')) : {};
  const files = fs.readdirSync(dir).filter((n) => /\.csv$/i.test(n));
  if (!files.length) throw Error(`No CSV files in ${dir}`);
  const rank = (f) => { const i = irwinFiles.findIndex((x) => x.match.test(f.toLowerCase())); return i < 0 ? 9 : i; };
  files.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return transaction(db, async () => {
    const out = [];
    for (const file of files) {
      const spec = irwinFiles.find((x) => x.match.test(file.toLowerCase()));
      if (!spec) throw Error(`Unrecognised file ${file}: expected Organizations, Contacts or Activities. See docs/replace-irwin.md`);
      const rows = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!rows.length) throw Error(`Empty file: ${file}`);
      let added = 0;
      for (const raw of rows) {
        const row = { ...raw };
        for (const [ours, theirs] of Object.entries(mapping[spec.entity] || {})) {
          if (!(theirs in raw)) throw Error(`${file}: mapped column "${theirs}" is not in the file`);
          row[ours] = raw[theirs];
        }
        if (spec.entity === 'institutions') await importInstitution(db, file, row);
        else if (spec.entity === 'contacts') await importContact(db, file, row);
        else await importMeeting(db, file, row);
        added++;
      }
      out.push({ file, entity: spec.entity, rows: added, dry_run: Boolean(flags['dry-run']) });
    }
    return out;
  }, Boolean(flags['dry-run']));
}

async function institutionByName(db, name) {
  return (await db.query('select * from institutions where lower(name)=lower($1) or lower(code)=lower($1)', [name]))[0] || null;
}

function kindOf(text) {
  const t = String(text || '').toLowerCase();
  if (/hedge/.test(t)) return 'hedge fund';
  if (/pension|super/.test(t)) return 'super fund';
  if (/family/.test(t)) return 'family office';
  if (/index|passive|etf/.test(t)) return 'index fund';
  if (/broker|sell.?side|bank/.test(t)) return 'broker';
  if (/retail/.test(t)) return 'retail group';
  return 'institution';
}

async function importInstitution(db, file, row) {
  const name = required(pick(row, 'name', 'Organization', 'Organization Name', 'Institution', 'Firm', 'Company'), `${file}: Organization name`);
  const aum = pick(row, 'aum', 'AUM', 'AUM (USD M)', 'Equity AUM', 'AUM ($M)');
  const values = [kindOf(pick(row, 'kind', 'Type', 'Organization Type', 'Institution Type', 'Investor Type')), pick(row, 'style', 'Style', 'Investment Style') || '',
    pick(row, 'city', 'City') || null, pick(row, 'country', 'Country') || null, aum ? number(aum, `${file} ${name}: AUM`, { min: 0 }) : null];
  const existing = await institutionByName(db, name);
  if (existing) {
    await db.query('update institutions set kind=$2,style=coalesce(nullif($3,\'\'),style),city=coalesce($4,city),country=coalesce($5,country),aum_m=coalesce($6,aum_m) where id=$1', [existing.id, ...values]);
    return;
  }
  const code = await uniqueCode(db, 'institutions', pick(row, 'code', 'Code', 'Ticker') || codeFrom(name));
  await db.query('insert into institutions(code,name,kind,style,city,country,aum_m) values($1,$2,$3,$4,$5,$6,$7)', [code.toUpperCase(), name, ...values]);
}

async function importContact(db, file, row) {
  const name = pick(row, 'name', 'Name', 'Full Name') || [pick(row, 'First Name', 'Firstname'), pick(row, 'Last Name', 'Lastname', 'Surname')].filter(Boolean).join(' ');
  required(name, `${file}: Name`);
  const org = pick(row, 'institution', 'Organization', 'Organization Name', 'Institution', 'Firm', 'Company');
  let inst = org ? await institutionByName(db, org) : null;
  if (org && !inst) {
    const code = await uniqueCode(db, 'institutions', codeFrom(org));
    inst = (await db.query('insert into institutions(code,name) values($1,$2) returning *', [code, org]))[0];
  }
  const email = pick(row, 'email', 'Email', 'E-mail', 'Email Address') || null;
  const existing = (await db.query('select id from contacts where (email is not null and lower(email)=lower($1)) or (lower(name)=lower($2) and institution_id is not distinct from $3)', [email, name, inst?.id || null]))[0];
  const values = [name, inst?.id || null, pick(row, 'role', 'Title', 'Job Title', 'Role') || '', email, pick(row, 'phone', 'Phone', 'Mobile', 'Direct Phone') || null, pick(row, 'city', 'City') || null];
  if (existing) { await db.query('update contacts set name=$2,institution_id=coalesce($3,institution_id),role=coalesce(nullif($4,\'\'),role),email=coalesce($5,email),phone=coalesce($6,phone),city=coalesce($7,city) where id=$1', [existing.id, ...values]); return; }
  const code = await uniqueCode(db, 'contacts', `IC${String((await db.query('select count(*)::int n from contacts'))[0].n + 1).padStart(3, '0')}`);
  await db.query('insert into contacts(code,name,institution_id,role,email,phone,city) values($1,$2,$3,$4,$5,$6,$7)', [code, ...values]);
}

// One activity row is one meeting with one organisation. Imported meetings are history: held and noted.
async function importMeeting(db, file, row) {
  const day = date(required(pick(row, 'date', 'Date', 'Activity Date', 'Start Date', 'Meeting Date'), `${file}: Date`).slice(0, 10), `${file}: Date`);
  const org = required(pick(row, 'institution', 'Organization', 'Organization Name', 'Institution', 'Firm', 'Company'), `${file} ${day}: Organization`);
  const inst = await institutionByName(db, org);
  if (!inst) throw Error(`${file}: activity on ${day} names ${org}, which is not in the database or the Organizations file`);
  const typeText = pick(row, 'kind', 'Type', 'Activity Type', 'Meeting Type').toLowerCase();
  const kind = /call|phone|video|zoom|teams/.test(typeText) ? 'call' : /group|lunch|breakfast/.test(typeText) ? 'group' : /conference/.test(typeText) ? 'conference' : /site|tour|visit/.test(typeText) ? 'site visit' : /email/.test(typeText) ? 'email' : 'one-on-one';
  const id = pick(row, 'id', 'ID', 'Activity ID');
  const code = `IRW-${id || `${day}-${inst.code}`}`;
  const notes = [pick(row, 'Subject', 'Title'), pick(row, 'notes', 'Notes', 'Description', 'Summary', 'Comments')].filter(Boolean).join(': ') || 'Imported from Irwin';
  const future = day >= today();
  const m = (await db.query('insert into meetings(code,held_on,kind,institution_id,status,notes,noted_on) values($1,$2,$3,$4,$5,$6,$7) on conflict(code) do nothing returning id',
    [code, day, kind, inst.id, future ? 'booked' : 'held', future ? null : notes, future ? null : day]))[0];
  if (!m) return;
  for (const n of String(pick(row, 'contacts', 'Attendees', 'Contacts', 'Participants', 'External Attendees')).split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
    const c = (await db.query('select id from contacts where lower(name)=lower($1) and institution_id=$2', [n, inst.id]))[0];
    if (c) await db.query('insert into meeting_contacts(meeting_id,contact_id) values($1,$2) on conflict do nothing', [m.id, c.id]);
  }
  for (const n of String(pick(row, 'team', 'Internal Attendees', 'Company Attendees', 'Hosts', 'Management')).split(/[;|,]/).map((x) => x.trim()).filter(Boolean)) {
    const t = (await db.query('select id from team where lower(code)=lower($1) or lower(name)=lower($1)', [n]))[0];
    if (t) await db.query('insert into meeting_team(meeting_id,team_id) values($1,$2) on conflict do nothing', [m.id, t.id]);
  }
}

const company = () => { try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name; } catch { return 'the company'; } };
const md = (rows) => {
  if (!rows.length) return '- none\n';
  const cols = Object.keys(rows[0]);
  return `| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n${rows.map((r) => `| ${cols.map((c) => (r[c] instanceof Date ? ymd(r[c]) : String(r[c] ?? '')).replace(/\|/g, '/')).join(' | ')} |`).join('\n')}\n`;
};

async function draft(db, cmd, ref) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  let body; let key;
  if (cmd === 'draft-briefing') {
    const i = await resolve(db, 'institutions', ref || undefined);
    const h = (await db.query('select * from v_holders where institution_id=$1', [i.id]))[0];
    const contacts = await db.query('select name,role from contacts where institution_id=$1 and active order by name', [i.id]);
    const met = await db.query('select held_on,kind,team,sentiment,themes,notes from v_meetings where institution_id=$1 and status=\'held\' order by held_on desc limit 4', [i.id]);
    const open = await db.query('select due_on,owner,action from v_follow_ups where institution=$1 and done_on is null order by due_on', [i.code]);
    const cons = (await db.query('select * from v_consensus'))[0];
    const themes = await db.query('select theme,times from v_themes limit 5');
    const bo = await db.query('select event from v_blackouts where current_date between starts_on and ends_on');
    key = i.code;
    body = `# DRAFT: meeting brief, ${i.name}\n\n${bo.length ? `BLACKOUT: today is inside the ${bo[0].event} blackout. Check with the disclosure officer before this meeting goes ahead.\n\n` : ''}## Who they are\n\n- ${i.kind}, ${i.style || 'style not recorded'}, ${[i.city, i.country].filter(Boolean).join(', ') || 'location not recorded'}${i.aum_m ? `, about ${Number(i.aum_m).toLocaleString('en-AU')} million under management` : ''}\n- Holding: ${Number(h.shares) > 0 ? `${Number(h.shares).toLocaleString('en-AU')} shares, ${(h.pct_bps / 100).toFixed(2)}% of the company, ranked ${h.rank} on the ${ymd((await db.query('select latest from v_register_dates'))[0].latest)} register (${Number(h.change) >= 0 ? 'up' : 'down'} ${Math.abs(Number(h.change)).toLocaleString('en-AU')} since the register before)` : 'not on the latest register'}\n- People: ${contacts.map((c) => `${c.name} (${c.role})`).join(', ') || 'none recorded'}\n\n## What they said last time\n\n${met.map((m) => `- ${ymd(m.held_on)} ${m.kind}${m.team ? ` with ${m.team}` : ''}${m.sentiment ? `, ${m.sentiment}` : ''}: ${m.notes || 'no notes written'}`).join('\n') || '- never met'}\n\n## Still owed to them\n\n${open.map((f) => `- ${f.action} (${f.owner || 'no owner'}, due ${ymd(f.due_on)})`).join('\n') || '- nothing open'}\n\n## What the market is asking since the last result\n\n${themes.map((t) => `- ${t.theme} (${t.times} meetings)`).join('\n') || '- no themes recorded'}\n\n## The street\n\n- ${cons.brokers} brokers: ${cons.buy} buy, ${cons.hold} hold, ${cons.sell} sell. Consensus target $${(cons.target_cents / 100).toFixed(2)} against $${(cons.price_cents / 100).toFixed(2)} last close.\n\nSay nothing that is not already released to the market. For review before the meeting. Nothing has been sent.\n`;
  } else if (cmd === 'draft-thank-you') {
    const m = await resolve(db, 'meetings', ref);
    const v = (await db.query('select * from v_meetings where meeting_id=$1', [m.id]))[0];
    const people = await db.query('select c.name,c.email from meeting_contacts x join contacts c on c.id=x.contact_id where x.meeting_id=$1 order by c.name', [m.id]);
    const fu = await db.query('select action,due_on,done_on from follow_ups where meeting_id=$1 order by due_on', [m.id]);
    key = m.code;
    body = `# DRAFT: thank you, ${v.institution_name}\n\nTo: ${people.map((p) => `${p.name} <${p.email || 'no email on file'}>`).join(', ') || '(no contact recorded)'}\n\nHi ${people[0]?.name.split(' ')[0] || 'there'},\n\nThank you for your time on ${ymd(v.held_on)}.\n\n${fu.length ? `As promised:\n\n${fu.map((f) => `- ${f.action}${f.done_on ? ' (attached)' : ` (by ${ymd(f.due_on)})`}`).join('\n')}\n\n` : ''}Everything we discussed is in our market announcements. Reply to this email for anything else.\n\nKind regards,\n\n${company()}\n\n${v.material_unreleased ? 'REVIEW BEFORE SENDING: the material shown at this meeting had not been released to the market. Check with the disclosure officer before sending.\n\n' : ''}For review before sending. Only attach material that is already on the market announcements platform. Nothing has been sent.\n`;
  } else if (cmd === 'draft-itinerary') {
    const r = await resolve(db, 'roadshows', ref || undefined);
    const rows = await db.query('select held_on,starts,institution_name,kind,contacts,team,material,coalesce(blackout,\'\') blackout from v_meetings where meeting_id in (select id from meetings where roadshow_id=$1) and status<>\'cancelled\' order by held_on,starts', [r.id]);
    key = r.code;
    body = `# DRAFT: itinerary, ${r.name}\n\n${r.city}, ${ymd(r.starts_on)} to ${ymd(r.ends_on)}${r.host_broker ? `. Hosted by ${r.host_broker}` : ''}.\n\n${md(rows.map((x) => ({ date: ymd(x.held_on), time: String(x.starts || '').slice(0, 5), investor: x.institution_name, kind: x.kind, attending: x.contacts || '', ours: x.team || '', material: x.material || '' })))}\n${rows.some((x) => x.blackout) ? 'REVIEW: one or more meetings fall inside a blackout.\n\n' : ''}For review before it goes to the broker. Nothing has been sent.\n`;
  } else if (cmd === 'draft-board-report') {
    key = today();
    const latest = (await db.query('select latest,previous from v_register_dates'))[0];
    body = `# DRAFT: investor relations report for the board\n\n${company()}, prepared ${today()}.\n\n## Register (${ymd(latest.latest)} against ${ymd(latest.previous)})\n\n${md(await db.query(`select rank,name,${pct('pct_bps')} pct,to_char(change,'FMS999,999,999,990') change from v_holders where shares>0 and rank<=10 order by rank`))}\n### Who moved\n\n${md(await db.query(`select name,move,${pct('prev_pct_bps')} before,${pct('pct_bps')} now,met_in_90d_before from v_movers order by change`))}\n## Meetings since the last result\n\n${md(await db.query('select title,meetings,positive,neutral,negative,themes from v_feedback limit 2'))}\n## Where management time went (180 days)\n\n${md(await db.query('select name,meetings,five_pct_plus,one_to_five_pct,under_one_pct,not_holding from v_exec_time'))}\n## The street\n\n${md(await db.query(`select brokers,buy,hold,sell,${dollars('target_cents')} consensus_target,${dollars('price_cents')} price,upside_pct from v_consensus`))}\n## Disclosure and calendar findings\n\n${md(await db.query('select rule,issue from v_compliance order by rule'))}\n## Coming up\n\n${md(await db.query("select on_date,title from v_calendar where on_date between current_date and current_date+60 order by on_date"))}\nFor the CFO and company secretary to check before it goes in the board pack. Nothing has been sent.\n`;
  } else throw Error(`Unknown draft: ${cmd}`);
  const file = path.join(dir, `${cmd.replace('draft-', '')}-${key}-${Date.now()}.md`);
  fs.writeFileSync(file, body);
  return [{ file }];
}

function print(value) {
  if (Array.isArray(value)) { console.log(value.length ? table(value, Object.keys(value[0]).map((key) => ({ key, label: key, format: fmt }))) : '(none)'); return; }
  for (const [key, v] of Object.entries(value)) { console.log(`\n${key}`); print(Array.isArray(v) ? v : [v]); }
}
function fmt(v) {
  if (v instanceof Date) return v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10).replace('T', ' ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'string' && /^\d{2}:\d{2}:00$/.test(v)) return v.slice(0, 5);
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const out = await run(db, process.argv.slice(2).filter((x) => x !== '--json'));
    if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2)); else print(out);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
