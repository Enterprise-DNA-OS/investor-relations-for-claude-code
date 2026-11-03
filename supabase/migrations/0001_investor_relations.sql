-- Investor Relations for Claude Code: the schema.
-- One listed company's investor programme: who owns it, who it is courting, every meeting and what
-- was said, what was promised, the material shown, the brokers covering it, and the market calendar.
-- Plain Postgres. Runs on any Postgres (Supabase, Neon, RDS) and on the embedded PGlite.
-- Shares are whole numbers, money is cents, percentages of the company are basis points (500 = 5%).

create table settings (
  key text primary key,
  value numeric not null,
  unit text not null default '',
  note text not null default ''
);

create or replace function setting(k text) returns numeric language sql stable as
$$ select value from settings where key = k $$;

create or replace function touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

-- The company's own people who meet investors.
create table team (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  role text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Investor organisations: holders, targets and past holders.
create table institutions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'institution' check (kind in ('institution','super fund','hedge fund','family office','index fund','broker','retail group','other')),
  style text not null default '',
  city text,
  country text,
  aum_m numeric,
  tier int not null default 2 check (tier between 1 and 3),
  status text not null default 'active' check (status in ('active','not a fit')),
  owner_id uuid references team(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- How an institution appears on the share register (custodian and nominee account names).
create table institution_aliases (
  alias text primary key,
  institution_id uuid not null references institutions(id) on delete cascade
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  institution_id uuid references institutions(id),
  role text not null default '',
  email text,
  phone text,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shares on issue over time, so a holding becomes a percentage of the company.
create table capital (
  as_at date primary key,
  shares_on_issue bigint not null check (shares_on_issue > 0),
  note text not null default ''
);

-- Each register snapshot (from the share registry or a beneficial ownership analysis).
create table registers (
  as_at date primary key,
  source text not null default 'registry',
  note text not null default ''
);

create table holdings (
  id uuid primary key default gen_random_uuid(),
  as_at date not null references registers(as_at) on delete cascade,
  institution_id uuid not null references institutions(id),
  shares bigint not null check (shares >= 0),
  unique (as_at, institution_id)
);

-- Substantial holder notices lodged with the market.
create table notices (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  lodged_on date not null,
  kind text not null check (kind in ('became','change','ceased')),
  shares bigint not null check (shares >= 0),
  ref text not null default '',
  created_at timestamptz not null default now()
);

create table roadshows (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null,
  starts_on date not null,
  ends_on date not null,
  purpose text not null default 'non-deal',
  host_broker text,
  check (ends_on >= starts_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Presentations and packs shown to investors, and when each went to the market.
create table materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  released_on date,
  announcement_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The market calendar: results, quarterlies, the AGM, investor days.
create table events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('half-year results','full-year results','quarterly','agm','investor day','dividend','other')),
  title text not null,
  period_end date,
  on_date date not null,
  lodged_on date,
  notice_sent_on date,
  blackout boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  held_on date not null,
  starts time,
  kind text not null default 'one-on-one' check (kind in ('one-on-one','group','call','conference','site visit','email')),
  institution_id uuid not null references institutions(id),
  roadshow_id uuid references roadshows(id),
  material_id uuid references materials(id),
  city text,
  status text not null default 'booked' check (status in ('booked','held','cancelled')),
  cancel_reason text,
  notes text,
  sentiment text check (sentiment in ('positive','neutral','negative')),
  themes text[] not null default '{}',
  noted_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meeting_team (
  meeting_id uuid not null references meetings(id) on delete cascade,
  team_id uuid not null references team(id),
  primary key (meeting_id, team_id)
);

create table meeting_contacts (
  meeting_id uuid not null references meetings(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  primary key (meeting_id, contact_id)
);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  meeting_id uuid references meetings(id),
  institution_id uuid not null references institutions(id),
  owner_id uuid references team(id),
  action text not null,
  due_on date not null,
  done_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sell-side brokers covering the stock.
create table coverage (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  broker text not null,
  analyst text not null default '',
  rating text not null check (rating in ('buy','hold','sell','not rated')),
  target_cents int,
  eps_fy1_cents numeric,
  eps_fy2_cents numeric,
  updated_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prices (
  on_date date primary key,
  close_cents int not null check (close_cents > 0)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  body text not null,
  created_at timestamptz not null default now()
);

create trigger team_touch before update on team for each row execute function touch_updated_at();
create trigger institutions_touch before update on institutions for each row execute function touch_updated_at();
create trigger contacts_touch before update on contacts for each row execute function touch_updated_at();
create trigger roadshows_touch before update on roadshows for each row execute function touch_updated_at();
create trigger materials_touch before update on materials for each row execute function touch_updated_at();
create trigger events_touch before update on events for each row execute function touch_updated_at();
create trigger meetings_touch before update on meetings for each row execute function touch_updated_at();
create trigger follow_ups_touch before update on follow_ups for each row execute function touch_updated_at();
create trigger coverage_touch before update on coverage for each row execute function touch_updated_at();

create index holdings_institution on holdings(institution_id, as_at);
create index meetings_institution on meetings(institution_id, held_on);
create index meetings_day on meetings(held_on);
create index follow_ups_open on follow_ups(due_on) where done_on is null;
create index notices_institution on notices(institution_id, lodged_on);

insert into settings(key, value, unit, note) values
  ('quiet_days', 180, 'days', 'A holder with no meeting for this long shows as gone quiet'),
  ('quiet_min_bps', 100, 'bps', 'Only holders with at least this share of the company are chased as quiet (100 = 1%)'),
  ('notes_due_days', 2, 'days', 'Meeting notes are due this many days after the meeting'),
  ('blackout_lead_days', 0, 'days', 'The blackout starts this many days before the period end of a blackout event'),
  ('substantial_bps', 500, 'bps', 'Substantial holding threshold (Corporations Act s9: 5%)'),
  ('movement_bps', 100, 'bps', 'A movement this size in a substantial holding needs a new notice (s671B: 1 percentage point)'),
  ('agm_notice_days', 28, 'days', 'Minimum notice of a general meeting of a listed company (s249HA)'),
  ('agm_due_months', 5, 'months', 'AGM due within this many months of the financial year end (s250N(2))'),
  ('preliminary_due_months', 2, 'months', 'Preliminary final report (Appendix 4E) due within this many months of year end (ASX LR 4.3B)'),
  ('half_year_due_days', 75, 'days', 'Half-year report due by the ASIC lodgement deadline, this many days after the half (ASX LR 4.2B, Corporations Act s320)'),
  ('quarterly_due_months', 1, 'months', 'Quarterly reports due within this many months of quarter end (ASX LR 4.7B, 5.1)'),
  ('coverage_stale_days', 120, 'days', 'A broker note older than this is flagged as stale'),
  ('follow_up_days', 7, 'days', 'Default due date for a new follow-up');

-- ---------------------------------------------------------------- views

-- The latest and previous register dates.
create view v_register_dates as
select (select max(as_at) from registers) latest,
       (select max(as_at) from registers where as_at < (select max(as_at) from registers)) previous;

-- Shares on issue at any date: the latest capital row on or before it.
create or replace function shares_on_issue(d date) returns bigint language sql stable as
$$ select coalesce((select shares_on_issue from capital where as_at <= d order by as_at desc limit 1),
                   (select shares_on_issue from capital order by as_at limit 1)) $$;

-- Every institution with its holding on the latest and previous register, and when we last met.
create view v_holders as
with d as (select * from v_register_dates),
h as (
  select i.id institution_id,
    coalesce((select shares from holdings x where x.institution_id = i.id and x.as_at = d.latest), 0) shares,
    coalesce((select shares from holdings x where x.institution_id = i.id and x.as_at = d.previous), 0) prev_shares
  from institutions i, d
),
m as (
  select institution_id, max(held_on) filter (where status = 'held') last_met,
    count(*) filter (where status = 'held' and held_on > current_date - 365)::int meetings_12m,
    min(held_on) filter (where status = 'booked' and held_on >= current_date) next_meeting
  from meetings group by institution_id
)
select i.id institution_id, i.code, i.name, i.kind, i.style, i.city, i.country, i.aum_m, i.tier, i.status,
  t.code owner, h.shares, h.prev_shares, h.shares - h.prev_shares change,
  case when d.latest is null then 0 else round(h.shares * 10000.0 / shares_on_issue(d.latest))::int end pct_bps,
  case when d.previous is null then 0 else round(h.prev_shares * 10000.0 / shares_on_issue(d.previous))::int end prev_pct_bps,
  case when h.shares > 0 then rank() over (order by h.shares desc) end rank,
  m.last_met, current_date - m.last_met days_since_met, coalesce(m.meetings_12m, 0) meetings_12m, m.next_meeting
from institutions i
join h on h.institution_id = i.id
cross join v_register_dates d
left join team t on t.id = i.owner_id
left join m on m.institution_id = i.id;

-- Who bought, sold, arrived or left between the last two registers, and whether we had seen them.
create view v_movers as
select code, name, style, prev_shares, shares, change, prev_pct_bps, pct_bps,
  case when prev_shares = 0 then 'new holder' when shares = 0 then 'exited' when change > 0 then 'bought' else 'sold' end move,
  last_met,
  (select count(*) from meetings m, v_register_dates d where m.institution_id = v.institution_id and m.status = 'held'
     and m.held_on > coalesce(d.previous, d.latest) - 90 and m.held_on <= d.latest)::int met_in_90d_before
from v_holders v
where change <> 0;

-- Holders worth seeing that nobody has seen lately.
create view v_quiet as
select code, name, kind, rank, pct_bps, owner, last_met, days_since_met, next_meeting
from v_holders
where shares > 0 and status = 'active' and kind <> 'index fund' and pct_bps >= setting('quiet_min_bps')
  and (last_met is null or days_since_met >= setting('quiet_days'))
  and next_meeting is null;

-- Institutions that do not hold, best prospects first.
create view v_targets as
select code, name, kind, style, city, tier, owner, meetings_12m, last_met, days_since_met, next_meeting,
  case when shares = 0 and prev_shares > 0 then 'sold out since last register'
       when meetings_12m >= 3 then 'met ' || meetings_12m || ' times, not holding'
       when last_met is null then 'never met' else '' end note
from v_holders
where shares = 0 and status = 'active' and kind not in ('broker','retail group');

-- Blackout windows from the calendar.
create view v_blackouts as
select e.code event, e.title, (e.period_end - setting('blackout_lead_days')::int) starts_on, e.on_date ends_on
from events e where e.blackout and e.period_end is not null;

create view v_meetings as
select m.id meeting_id, m.code, m.held_on, m.starts, m.kind, m.status, m.institution_id, i.code institution, i.name institution_name,
  r.code roadshow, mt.code material, m.city,
  (select string_agg(t.code, ',' order by t.code) from meeting_team x join team t on t.id = x.team_id where x.meeting_id = m.id) team,
  (select string_agg(c.name, ', ' order by c.name) from meeting_contacts x join contacts c on c.id = x.contact_id where x.meeting_id = m.id) contacts,
  h.pct_bps, m.sentiment, array_to_string(m.themes, ', ') themes, m.notes, m.noted_on,
  (select b.event from v_blackouts b where m.held_on between b.starts_on and b.ends_on limit 1) blackout,
  case when mt.id is not null and (mt.released_on is null or mt.released_on > m.held_on) then true else false end material_unreleased
from meetings m
join institutions i on i.id = m.institution_id
left join v_holders h on h.institution_id = m.institution_id
left join roadshows r on r.id = m.roadshow_id
left join materials mt on mt.id = m.material_id;

create view v_follow_ups as
select f.code, f.due_on, current_date - f.due_on days_over, i.code institution, i.name institution_name, t.code owner, f.action,
  m.code meeting, f.done_on
from follow_ups f
join institutions i on i.id = f.institution_id
left join team t on t.id = f.owner_id
left join meetings m on m.id = f.meeting_id;

-- The calendar with each deadline worked out.
create view v_calendar as
select e.id event_id, e.code, e.kind, e.title, e.period_end, e.on_date, e.lodged_on, e.notice_sent_on, e.blackout,
  case
    when e.kind = 'full-year results' and e.period_end is not null then (e.period_end + (setting('preliminary_due_months')::int || ' months')::interval)::date
    when e.kind = 'half-year results' and e.period_end is not null then e.period_end + setting('half_year_due_days')::int
    when e.kind = 'quarterly' and e.period_end is not null then (e.period_end + (setting('quarterly_due_months')::int || ' months')::interval)::date
    when e.kind = 'agm' and e.period_end is not null then (e.period_end + (setting('agm_due_months')::int || ' months')::interval)::date
  end due_by,
  case when e.kind = 'agm' and e.notice_sent_on is not null then e.on_date - e.notice_sent_on end notice_days,
  e.on_date - current_date days_away
from events e;

-- Broker coverage and the consensus it makes.
create view v_coverage as
select c.code, c.broker, c.analyst, c.rating, c.target_cents, c.eps_fy1_cents, c.eps_fy2_cents, c.updated_on,
  current_date - c.updated_on days_old,
  (select close_cents from prices order by on_date desc limit 1) price_cents,
  case when c.target_cents is null then null else round((c.target_cents * 100.0 / (select close_cents from prices order by on_date desc limit 1)) - 100, 1) end upside_pct
from coverage c where c.active;

create view v_consensus as
select count(*)::int brokers,
  count(*) filter (where rating = 'buy')::int buy, count(*) filter (where rating = 'hold')::int hold, count(*) filter (where rating = 'sell')::int sell,
  round(avg(target_cents))::int target_cents, min(target_cents) low_cents, max(target_cents) high_cents,
  round(avg(eps_fy1_cents), 1) eps_fy1_cents, round(avg(eps_fy2_cents), 1) eps_fy2_cents,
  (select close_cents from prices order by on_date desc limit 1) price_cents,
  round((avg(target_cents) * 100.0 / (select close_cents from prices order by on_date desc limit 1)) - 100, 1) upside_pct,
  (select broker from coverage where active order by updated_on desc limit 1) last_moved
from coverage where active;

-- Where management's time went in the last 180 days, by how much of the company each investor owns.
create view v_exec_time as
select t.code, t.name, t.role,
  count(*) filter (where h.pct_bps >= 500)::int five_pct_plus,
  count(*) filter (where h.pct_bps >= 100 and h.pct_bps < 500)::int one_to_five_pct,
  count(*) filter (where h.shares > 0 and h.pct_bps < 100)::int under_one_pct,
  count(*) filter (where h.shares = 0)::int not_holding,
  count(*)::int meetings
from team t
join meeting_team x on x.team_id = t.id
join meetings m on m.id = x.meeting_id and m.status = 'held' and m.held_on > current_date - 180
join v_holders h on h.institution_id = m.institution_id
group by t.id
order by meetings desc;

-- What investors said after each result: meetings in the 30 days after it, sentiment and themes.
create view v_feedback as
select e.code event, e.title, e.on_date,
  count(m.id)::int meetings,
  count(*) filter (where m.sentiment = 'positive')::int positive,
  count(*) filter (where m.sentiment = 'neutral')::int neutral,
  count(*) filter (where m.sentiment = 'negative')::int negative,
  (select string_agg(theme || ' (' || n || ')', ', ' order by n desc, theme) from (
     select theme, count(*) n from meetings m2, unnest(m2.themes) theme
     where m2.status = 'held' and m2.held_on between e.on_date and e.on_date + 30 group by theme) z) themes
from events e
left join meetings m on m.status = 'held' and m.held_on between e.on_date and e.on_date + 30
where e.kind in ('half-year results','full-year results') and e.on_date <= current_date
group by e.id
order by e.on_date desc;

create view v_themes as
select theme, count(*)::int times, count(distinct m.institution_id)::int investors,
  count(*) filter (where m.sentiment = 'negative')::int negative, max(m.held_on) last_raised
from meetings m, unnest(m.themes) theme
where m.status = 'held' and m.held_on >= coalesce((select max(on_date) from events where kind in ('half-year results','full-year results') and on_date <= current_date), current_date - 180)
group by theme order by times desc, theme;

-- Every rule in docs/compliance.md, run against the records.
create view v_compliance as
select 'MATERIAL-NOT-RELEASED' rule, m.code record,
  m.institution || ' ' || m.kind || ' ' || m.status || ' on ' || to_char(m.held_on, 'YYYY-MM-DD') || ': ' || mt.title || case when m.status = 'booked' then ' to be shown ' else ' shown ' end ||
  case when mt.released_on is null then 'and not released to the market' else 'before its market release on ' || to_char(mt.released_on, 'YYYY-MM-DD') end issue
from v_meetings m join materials mt on mt.code = m.material
where m.status <> 'cancelled' and m.material_unreleased
union all
select 'BLACKOUT-MEETING', m.code, m.institution || ' ' || m.kind || ' ' || m.status || ' on ' || to_char(m.held_on, 'YYYY-MM-DD') || ' inside the ' || m.blackout || ' blackout'
from v_meetings m
where m.status <> 'cancelled' and m.blackout is not null and m.kind in ('one-on-one','group','call','site visit')
union all
select 'NOTES-NOT-WRITTEN', m.code, m.institution || ' ' || m.kind || ' on ' || to_char(m.held_on, 'YYYY-MM-DD') || ': no record of what was discussed after ' || (current_date - m.held_on) || ' days'
from v_meetings m
where m.status = 'held' and m.noted_on is null and m.held_on < current_date - setting('notes_due_days')::int
union all
select 'SUBSTANTIAL-NOTICE', h.code,
  h.name || ' holds ' || to_char(h.pct_bps / 100.0, 'FM990.00') || '% on the ' || to_char(d.latest, 'YYYY-MM-DD') || ' register; ' ||
  case when n.kind is null then 'no substantial holder notice on file'
       when h.pct_bps < setting('substantial_bps') then 'last notice (' || n.kind || ', ' || to_char(n.pct_bps / 100.0, 'FM990.00') || '%) and no ceasing notice'
       else 'last notice ' || to_char(n.pct_bps / 100.0, 'FM990.00') || '% on ' || to_char(n.lodged_on, 'YYYY-MM-DD') end
from v_holders h
cross join v_register_dates d
left join lateral (
  select x.kind, x.lodged_on, round(x.shares * 10000.0 / shares_on_issue(x.lodged_on))::int pct_bps
  from notices x where x.institution_id = h.institution_id order by x.lodged_on desc limit 1
) n on true
where (h.pct_bps >= setting('substantial_bps') and (n.kind is null or n.kind = 'ceased' or abs(h.pct_bps - n.pct_bps) >= setting('movement_bps')))
   or (h.pct_bps < setting('substantial_bps') and n.kind in ('became','change') and n.pct_bps >= setting('substantial_bps'))
union all
select 'AGM-NOTICE', c.code, c.title || ': notice sent ' || to_char(c.notice_sent_on, 'YYYY-MM-DD') || ', only ' || c.notice_days || ' days before the meeting (minimum ' || setting('agm_notice_days') || ')'
from v_calendar c where c.kind = 'agm' and c.notice_days < setting('agm_notice_days')
union all
select 'AGM-DEADLINE', c.code, c.title || ' on ' || to_char(c.on_date, 'YYYY-MM-DD') || ' is after ' || to_char(c.due_by, 'YYYY-MM-DD') || ' (' || setting('agm_due_months') || ' months from year end)'
from v_calendar c where c.kind = 'agm' and c.due_by < c.on_date
union all
select case when c.kind = 'quarterly' then 'QUARTERLY-DEADLINE' else 'RESULTS-DEADLINE' end, c.code,
  c.title || case when c.lodged_on is not null then ' lodged ' || to_char(c.lodged_on, 'YYYY-MM-DD') else ' planned for ' || to_char(c.on_date, 'YYYY-MM-DD') end ||
  ', due by ' || to_char(c.due_by, 'YYYY-MM-DD')
from v_calendar c
where c.kind in ('half-year results','full-year results','quarterly') and c.due_by < coalesce(c.lodged_on, c.on_date);

-- One list of everything that needs chasing.
create view v_attention as
select 'rule finding' kind, record, null::date due, rule || ': ' || issue detail from v_compliance
union all
select 'follow-up overdue', code, due_on, institution || ' (' || coalesce(owner, 'no owner') || '): ' || action from v_follow_ups where done_on is null and due_on < current_date
union all
select 'follow-up due this week', code, due_on, institution || ' (' || coalesce(owner, 'no owner') || '): ' || action from v_follow_ups where done_on is null and due_on between current_date and current_date + 7
union all
select 'holder gone quiet', code, null, name || ', ' || to_char(pct_bps / 100.0, 'FM990.00') || '%, ' || coalesce('last met ' || days_since_met || ' days ago', 'never met') from v_quiet
union all
select 'holder sold', code, null, name || ' sold ' || to_char(-change, 'FM999,999,999,999') || ' shares' || case when met_in_90d_before > 0 then ' after ' || met_in_90d_before || ' meeting(s) in the 90 days before' else '' end from v_movers where move in ('sold','exited')
union all
select 'meeting this week', code, held_on, institution || ' ' || kind || coalesce(' with ' || team, '') from v_meetings where status = 'booked' and held_on between current_date and current_date + 7
union all
select 'deadline coming', code, due_by, title || ' due by ' || to_char(due_by, 'YYYY-MM-DD') from v_calendar where lodged_on is null and due_by between current_date and current_date + 30
union all
select 'event coming', code, on_date, title from v_calendar where on_date between current_date and current_date + 14
union all
select 'blackout', event, ends_on, title || ' blackout ' || to_char(starts_on, 'YYYY-MM-DD') || ' to ' || to_char(ends_on, 'YYYY-MM-DD') from v_blackouts where ends_on >= current_date and starts_on <= current_date + 14
union all
select 'broker note stale', code, updated_on, broker || ' last updated ' || days_old || ' days ago' from v_coverage where days_old > setting('coverage_stale_days');

-- Nothing in this database is public: no access for the anonymous roles a hosted Postgres exposes.
do $$
declare t text;
begin
  foreach t in array array['settings','team','institutions','institution_aliases','contacts','capital','registers','holdings','notices','roadshows','materials','events','meetings','meeting_team','meeting_contacts','follow_ups','coverage','prices','notes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;
