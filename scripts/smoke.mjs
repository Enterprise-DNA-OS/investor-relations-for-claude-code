// npm test: a temp database, migrate, seed twice, then every command and every rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, reads, help } from './ir.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'investor-relations-test-'));
// A blank URL keeps tests off any real database named in .env.
process.env.DATABASE_URL = ''; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
let db; let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const rejects = async (args, re) => { await assert.rejects(() => run(db, args), re); checks++; };
const child = (script, args = []) => {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env: process.env, encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(p.status, 0, p.stderr || p.stdout); checks++; return p.stdout;
};
const daysFrom = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rules = async () => (await run(db, ['compliance'])).map((r) => `${r.rule} ${r.record}`);

try {
  db = await getDb();
  eq((await migrate(db)).ran.length, 1); eq((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  eq((await run(db, ['institutions'])).length, 15); eq((await run(db, ['holders'])).length, 10);
  eq((await db.query('select count(*)::int n from meetings'))[0].n, 27);
  eq((await db.query('select count(*)::int n from notices'))[0].n, 3);

  for (const name of Object.keys(reads)) ok(Array.isArray(await run(db, [name])), name);
  ok(help.length > 55, 'help lists every command');

  // Every rule has something to say on the demo.
  eq((await rules()).sort(), [
    'AGM-NOTICE AGM26', 'BLACKOUT-MEETING M1031', 'BLACKOUT-MEETING M1050',
    'MATERIAL-NOT-RELEASED M1020', 'MATERIAL-NOT-RELEASED M1021', 'MATERIAL-NOT-RELEASED M1022', 'MATERIAL-NOT-RELEASED M1052',
    'NOTES-NOT-WRITTEN M1044', 'QUARTERLY-DEADLINE Q1FY27', 'RESULTS-DEADLINE HY26',
    'SUBSTANTIAL-NOTICE BHA', 'SUBSTANTIAL-NOTICE KSF', 'SUBSTANTIAL-NOTICE TPC',
  ]);
  ok((await run(db, ['compliance'])).find((r) => r.record === 'BHA').issue.includes('no ceasing notice'), 'BHA ceased without a notice');

  // The register, movers, quiet holders and targets.
  const holders = await run(db, ['holders']);
  eq(holders[0].code, 'TPC'); eq(holders[0].pct, '6.60%'); eq(holders[0].change, '+5,725,000');
  eq((await run(db, ['movers'])).map((r) => `${r.code} ${r.move}`), ['BHA sold', 'RCL exited', 'GSC sold', 'SMI bought', 'ILP bought', 'KSF bought', 'TPC bought']);
  eq((await run(db, ['movers'])).find((r) => r.code === 'GSC').met_in_90d_before, 6);
  eq((await run(db, ['quiet'])).map((r) => r.code), ['CSE', 'NFO']);
  const targets = await run(db, ['targets']);
  eq(targets.map((r) => r.code), ['SIP', 'RCL', 'AVF', 'HGS']);
  eq(targets[0].note, 'met 3 times, not holding'); eq(targets[1].note, 'sold out since last register');

  // Meetings, notes, follow-ups, the calendar and the street.
  eq((await run(db, ['upcoming'])).map((r) => r.code), ['M1050', 'M1051', 'M1052']);
  eq((await run(db, ['upcoming']))[0].blackout, 'Q1FY27');
  eq((await run(db, ['notes-due'])).map((r) => r.code), ['M1044']);
  eq((await run(db, ['follow-ups'])).map((r) => r.code), ['FU101', 'FU103', 'FU102', 'FU105']);
  const cons = (await run(db, ['consensus']))[0];
  eq([cons.brokers, cons.buy, cons.hold, cons.sell, cons.consensus_target, cons.price, cons.last_moved], [5, 3, 1, 1, '$2.64', '$2.28', 'Ellerslie Partners']);
  eq((await run(db, ['blackouts'])).find((r) => r.state === 'now').event, 'Q1FY27');
  const exec = await run(db, ['exec-time']);
  eq([exec[0].code, exec[0].meetings, exec[0].under_one_pct], ['HM', 15, 7]);
  const fb = await run(db, ['feedback']);
  eq(fb.map((r) => r.event), ['FY26', 'HY26']); eq([fb[0].meetings, fb[0].negative], [14, 2]);
  ok(fb[0].themes.startsWith('margins (8)'), 'margins led after the full year');
  eq((await run(db, ['themes']))[0].theme, 'margins');
  const att = await run(db, ['attention']);
  for (const k of ['rule finding', 'follow-up overdue', 'follow-up due this week', 'holder gone quiet', 'holder sold', 'meeting this week', 'deadline coming', 'event coming', 'blackout', 'broker note stale']) ok(att.some((r) => r.kind === k), k);

  // One investor, one meeting, one roadshow.
  const tpc = await run(db, ['investor', 'tasman']);
  eq(tpc.investor[0].code, 'TPC'); eq(tpc.holdings.length, 2); eq(tpc.contacts.length, 2); eq(tpc.notes.length, 1); eq(tpc.follow_ups[0].code, 'FU101');
  eq((await run(db, ['meeting', 'M1010'])).follow_ups[0].code, 'FU101');
  eq((await run(db, ['roadshow', 'R-NZ'])).meetings.length, 3);

  // Matching: partial codes and names, ambiguity lists candidates.
  await rejects(['investor', 'Partners'], /Ambiguous institution.*ILP.*SIP/);
  await rejects(['investor', 'Nobody'], /No matching institution/);
  eq((await run(db, ['investor', 'kestrel'])).investor[0].code, 'KSF');

  // Booking refuses a blackout and unreleased material unless the disclosure officer says yes.
  await rejects(['meet', 'SIP', `--date=${daysFrom(1)}`, '--team=HM'], /Not booked: inside the Q1FY27 blackout/);
  await rejects(['meet', 'TPC', `--date=${daysFrom(20)}`, '--material=MAT-ID'], /MAT-ID is not released to the market yet/);
  await rejects(['meet', 'TPC', `--date=${daysFrom(20)}`, '--kind=dinner'], /Invalid kind/);
  await rejects(['meet', 'TPC', `--date=${daysFrom(20)}`, '--contacts=Priya'], /Priya Nair is not at Tasman Peak Capital/);
  const booked = await run(db, ['meet', 'Halcyon', `--date=${daysFrom(20)}`, '--kind=call', '--team=HM,LT', '--contacts=Emma', '--start=19:00']);
  eq([booked[0].code, booked[0].status, booked[0].team, booked[0].contacts], ['M2001', 'booked', 'HM,LT', 'Emma Hughes']);
  const forced = await run(db, ['meet', 'AVF', `--date=${daysFrom(1)}`, '--kind=call', '--force']);
  eq(forced[0].blackout, 'Q1FY27');
  ok((await rules()).includes(`BLACKOUT-MEETING ${forced[0].code}`), 'a forced meeting still shows as a finding');
  await run(db, ['cancel', forced[0].code, '--reason=blackout']);
  ok(!(await rules()).includes(`BLACKOUT-MEETING ${forced[0].code}`), 'cancelled meetings drop out');
  await rejects(['cancel', forced[0].code, '--reason=again'], /only a booked meeting/);

  // Notes are written once, never rewritten; future meetings cannot be noted.
  await rejects(['note', 'M2001', '--notes=early'], /write the notes after it happens/);
  await rejects(['note', 'M1044', '--notes=x', '--sentiment=great'], /Invalid sentiment/);
  const noted = await run(db, ['note', 'M1044', '--notes=Asked about the index review.', '--sentiment=neutral', '--themes=Index inclusion']);
  eq(noted[0].themes, 'index inclusion');
  await rejects(['note', 'M1044', '--notes=changed'], /not rewritten/);
  ok(!(await rules()).includes('NOTES-NOT-WRITTEN M1044'), 'notes written clears the finding');

  // Follow-ups.
  const fu = await run(db, ['follow-up', 'M1044', 'Send', 'the', 'index', 'note', '--owner=LT']);
  eq([fu[0].code, fu[0].owner, fu[0].institution], ['FU201', 'LT', 'GSC']);
  await run(db, ['done', 'FU101']);
  await rejects(['done', 'FU101'], /was done on/);
  ok(!(await run(db, ['follow-ups'])).some((r) => r.code === 'FU101'), 'done drops off');

  // Releasing material, lodging, notices and the AGM.
  await run(db, ['release', 'MAT-NZ', `--date=${daysFrom(-61)}`, '--ref=NZ investor presentation']);
  ok(!(await rules()).some((r) => r.startsWith('MATERIAL-NOT-RELEASED M102')), 'released before the roadshow clears it');
  await rejects(['release', 'MAT-NZ'], /was released on/);
  await run(db, ['notice', 'KSF', 'became', '--shares=21862500', `--date=${daysFrom(-5)}`, '--ref=Form 603']);
  await run(db, ['notice', 'BHA', 'ceased', '--shares=16087500', `--date=${daysFrom(-5)}`]);
  await run(db, ['notice', 'TPC', 'change', '--shares=27225000', `--date=${daysFrom(-5)}`]);
  ok(!(await rules()).some((r) => r.startsWith('SUBSTANTIAL-NOTICE')), 'notices on file clear the findings');
  await rejects(['notice', 'TPC', 'sold', '--shares=1'], /Invalid notice/);
  await run(db, ['notice-sent', 'AGM26', `--date=${daysFrom(-20)}`]);
  ok(!(await rules()).includes('AGM-NOTICE AGM26'), '34 days notice clears it');
  await rejects(['notice-sent', 'Q1FY27'], /is for the AGM/);
  await run(db, ['lodge', 'Q1FY27', `--date=${daysFrom(-6)}`]);
  await rejects(['lodge', 'Q1FY27'], /was lodged on/);
  ok(!(await rules()).includes('QUARTERLY-DEADLINE Q1FY27') || (await db.query("select due_by from v_calendar where code='Q1FY27'"))[0].due_by < daysFrom(-6), 'lodged on time clears it');

  // The street, price and capital.
  const rated = await run(db, ['rate', 'Kauri', '--rating=hold', '--target=2.20', '--eps1=16.5']);
  eq([rated[0].rating, rated[0].target], ['hold', '$2.20']);
  ok(!(await run(db, ['attention'])).some((r) => r.kind === 'broker note stale'), 'updated note is not stale');
  await run(db, ['price', '2.40']);
  eq((await run(db, ['consensus']))[0].price, '$2.40');
  await run(db, ['capital', '425000000', `--date=${daysFrom(-3)}`]);
  await rejects(['capital', '12.5'], /whole number/);

  // Adding records.
  await run(db, ['add', 'team', 'CS', 'Chris', 'Sims', '--role=Company secretary']);
  await run(db, ['add', 'institution', 'KWF', 'Kowhai Wealth Fund', '--kind=family office', '--city=Auckland', '--tier=1', '--owner=LT']);
  await rejects(['add', 'institution', 'BAD', 'Bad', '--kind=bank'], /Invalid kind/);
  await run(db, ['add', 'contact', 'C50', 'Ana', 'Kahu', '--institution=Kowhai', '--role=Principal']);
  await run(db, ['add', 'roadshow', 'R-AKL', 'Auckland', 'non-deal', '--city=Auckland', `--from=${daysFrom(30)}`, `--to=${daysFrom(31)}`]);
  await rejects(['add', 'roadshow', 'R-X', 'Bad', '--city=Perth', `--from=${daysFrom(30)}`, `--to=${daysFrom(29)}`], /ends before it starts/);
  await run(db, ['add', 'material', 'MAT-AKL', 'Auckland', 'deck', `--released=${daysFrom(-1)}`]);
  await run(db, ['add', 'event', 'HY27Q', 'Half-year', 'quarterly', '--kind=quarterly', `--period-end=${daysFrom(50)}`, `--date=${daysFrom(70)}`, '--blackout']);
  await rejects(['add', 'event', 'BAD', 'Bad', '--kind=party', `--date=${daysFrom(1)}`], /Invalid kind/);
  await run(db, ['add', 'coverage', 'NEW', 'New', 'Broker', '--rating=buy', '--target=3.00', '--analyst=Jo Bloggs']);
  await rejects(['add', 'coverage', 'BAD', 'Bad', '--rating=strong buy'], /Invalid rating/);
  const akl = await run(db, ['meet', 'Kowhai', `--date=${daysFrom(30)}`, '--roadshow=R-AKL', '--material=MAT-AKL', '--contacts=Ana', '--team=HM']);
  eq(akl[0].material, 'MAT-AKL');
  eq((await run(db, ['roadshow', 'R-AKL'])).also_in_city.map((r) => r.code).sort(), ['ILP', 'PFL', 'RCL']);
  await run(db, ['setting', 'quiet_days', '400']);
  eq((await run(db, ['quiet'])).length, 0);
  await rejects(['setting', 'nope', '1'], /No setting nope/);
  await run(db, ['log', 'NFO', 'Prefers', 'a', 'call', 'in', 'March']);
  eq((await run(db, ['investor', 'NFO'])).notes.length, 1);
  await run(db, ['alias', 'KWF', 'Kowhai Wealth Nominees Limited']);

  // Imports: Irwin history and a registry file.
  const fx = path.join(REPO_ROOT, 'tests', 'fixtures');
  eq((await run(db, ['import', 'irwin', path.join(fx, 'irwin'), '--dry-run'])).map((r) => r.rows), [4, 4, 3]);
  eq((await db.query("select count(*)::int n from institutions where name='Matai Street Partners'"))[0].n, 0);
  await run(db, ['import', 'irwin', path.join(fx, 'irwin')]);
  await run(db, ['import', 'irwin', path.join(fx, 'irwin')]);
  eq((await db.query("select count(*)::int n from institutions where name in ('Matai Street Partners','Bellbird Pension Trust','Coastline Hedge Partners, LP')"))[0].n, 3);
  eq((await db.query("select count(*)::int n from institutions where name='Tasman Peak Capital'"))[0].n, 1);
  eq((await db.query("select count(*)::int n from contacts where email='olivia.grant@example.com'"))[0].n, 1);
  eq((await db.query("select count(*)::int n from meetings where code like 'IRW-%'"))[0].n, 3);
  const matai = await run(db, ['investor', 'Matai']);
  eq([matai.meetings[0].team, matai.meetings[0].contacts, matai.meetings[0].kind], ['HM,LT', 'Hemi Parata', 'one-on-one']);
  eq((await run(db, ['investor', 'Bellbird'])).investor[0].kind, 'super fund');
  await rejects(['import', 'irwin', path.join(fx, 'irwin'), `--map=${path.join(fx, 'bad-map.json')}`], /mapped column "Firm Name" is not in the file/);

  const reg = await run(db, ['import', 'register', path.join(fx, 'register.csv'), `--date=${daysFrom(0)}`, '--top']);
  eq([reg.result[0].institutions, reg.result[0].carried_forward, reg.result[0].unmatched_lines], [6, 4, 1]);
  eq(reg.unmatched[0].holder, 'UNKNOWN FAMILY TRUST <SMITH A/C>');
  eq((await run(db, ['movers'])).map((r) => `${r.code} ${r.move}`), ['BHA sold', 'TPC bought']);
  const full = await run(db, ['import', 'register', path.join(fx, 'register.csv'), `--date=${daysFrom(0)}`, '--dry-run']);
  eq(full.result[0].carried_forward, 0);
  await rejects(['import', 'register', path.join(fx, 'register.csv')], /Required: register date/);
  await rejects(['import', 'nope', fx], /Supported imports/);

  // Drafts never send.
  for (const [cmd, ref] of [['draft-briefing', 'TPC'], ['draft-thank-you', 'M1010'], ['draft-itinerary', 'R-FY26'], ['draft-board-report', '']]) {
    const out = await run(db, [cmd, ...(ref ? [ref] : [])]);
    const text = fs.readFileSync(out[0].file, 'utf8');
    ok(text.startsWith('# DRAFT') && text.includes('Nothing has been sent'), cmd);
  }
  ok(fs.readFileSync((await run(db, ['draft-briefing', 'SIP']))[0].file, 'utf8').includes('BLACKOUT'), 'briefing warns in a blackout');

  // Export, then the CLI, views and documents as separate processes.
  const counts = await run(db, ['export', path.join(temp, 'export')]);
  eq(counts.length, 19); ok(fs.existsSync(path.join(temp, 'export', 'manifest.json')), 'manifest');
  await db.close(); db = null;
  ok(child('ir.mjs', ['holders']).includes('Tasman Peak Capital'), 'cli prints');
  ok(JSON.parse(child('ir.mjs', ['consensus', '--json']))[0].brokers === 6, 'cli json');
  const bad = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'ir.mjs'), 'investor', 'Partners'], { env: process.env, encoding: 'utf8' });
  eq(bad.status, 1); ok(bad.stderr.includes('Ambiguous'), 'exit 1 on ambiguity');
  ok(child('view.mjs').includes('views/register.html') || child('view.mjs').includes('views\\register.html'), 'views render');
  ok(/\d+ document\(s\) rendered/.test(child('docs.mjs')), 'documents render');
  console.log(`PASS ${checks} checks`);
} finally {
  await db?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
