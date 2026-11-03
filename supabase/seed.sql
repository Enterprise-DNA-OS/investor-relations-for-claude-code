-- Fictional Harbourline Group Limited: an ASX-listed packaging maker with 412.5 million shares,
-- a June year end, four people who meet investors, fifteen institutions, two register snapshots,
-- two roadshows, five brokers and the market calendar. Dated relative to today so there is always
-- something to chase: substantial holders without notices, a deck shown before release, meetings
-- in a blackout, overdue follow-ups, holders gone quiet and a late quarterly.
-- Idempotent: running it twice changes nothing and never resets later changes.

insert into team(code,name,role) values
 ('HM','Hannah Moore','Managing director and CEO'),
 ('RP','Raj Patel','Chief financial officer'),
 ('LT','Lucy Tane','Head of investor relations'),
 ('GW','Graham Ward','Chair')
on conflict (code) do nothing;

insert into institutions(code,name,kind,style,city,country,aum_m,tier,owner_id)
select v.code,v.name,v.kind,v.style,v.city,v.country,v.aum,v.tier,t.id from (values
 ('TPC','Tasman Peak Capital','institution','growth','Sydney','Australia',18500,1,'LT'),
 ('SMI','Southern Meridian Investors','institution','value','Melbourne','Australia',42000,1,'LT'),
 ('KSF','Kestrel Super','super fund','core','Sydney','Australia',96000,1,'RP'),
 ('BHA','Blue Harbour Asset Management','institution','small cap growth','Sydney','Australia',6200,1,'LT'),
 ('ILP','Ironbark Lane Partners','institution','growth at a reasonable price','Auckland','New Zealand',3100,2,'LT'),
 ('NFO','Northcote Family Office','family office','long term','Melbourne','Australia',900,2,'HM'),
 ('PFL','Pohutukawa Funds','institution','income','Auckland','New Zealand',2400,2,'LT'),
 ('GSC','Granite Street Capital','hedge fund','event driven','Sydney','Australia',1500,3,'LT'),
 ('CSE','Coral Sea Equities','institution','value','Brisbane','Australia',4800,2,'RP'),
 ('WIF','Wattle Index Funds','index fund','passive','Melbourne','Australia',150000,3,null),
 ('RCL','Rangitoto Capital','institution','small cap growth','Auckland','New Zealand',1200,1,'LT'),
 ('SIP','Stonefield Investment Partners','institution','small cap growth','Melbourne','Australia',5400,1,'LT'),
 ('AVF','Ardent Value Fund','institution','value','Sydney','Australia',2700,2,'RP'),
 ('HGS','Halcyon Global Small Caps','institution','global small cap','London','United Kingdom',8800,2,'LT'),
 ('HSS','Harbour Street Securities','broker','sell-side','Sydney','Australia',null,3,null)
) v(code,name,kind,style,city,country,aum,tier,owner) left join team t on t.code=v.owner
on conflict (code) do nothing;

insert into institution_aliases(alias,institution_id)
select v.alias,i.id from (values
 ('J P MORGAN NOMINEES AUSTRALIA PTY LIMITED <TASMAN PEAK A/C>','TPC'),
 ('HSBC CUSTODY NOMINEES (AUSTRALIA) LIMITED <SOUTHERN MERIDIAN A/C>','SMI'),
 ('CITICORP NOMINEES PTY LIMITED <KESTREL SUPER A/C>','KSF'),
 ('NATIONAL NOMINEES LIMITED <BLUE HARBOUR A/C>','BHA'),
 ('NORTHCOTE INVESTMENTS PTY LTD','NFO'),
 ('BNP PARIBAS NOMS PTY LTD <WATTLE INDEX A/C>','WIF')
) v(alias,code) join institutions i on i.code=v.code
on conflict (alias) do nothing;

insert into contacts(code,name,institution_id,role,email,phone,city)
select v.code,v.name,i.id,v.role,v.email,v.phone,v.city from (values
 ('C01','Olivia Grant','TPC','Portfolio manager','olivia.grant@example.com','+61 2 5550 0101','Sydney'),
 ('C02','Ben Hollis','TPC','Analyst','ben.hollis@example.com','+61 2 5550 0102','Sydney'),
 ('C03','Marcus Webb','SMI','Portfolio manager','marcus.webb@example.com','+61 3 5550 0201','Melbourne'),
 ('C04','Priya Nair','KSF','Head of Australian equities','priya.nair@example.com','+61 2 5550 0301','Sydney'),
 ('C05','Tom Carver','BHA','Portfolio manager','tom.carver@example.com','+61 2 5550 0401','Sydney'),
 ('C06','Aroha Walker','ILP','Portfolio manager','aroha.walker@example.com','+64 9 555 0501','Auckland'),
 ('C07','Elizabeth Northcote','NFO','Principal','liz@example.com','+61 3 5550 0601','Melbourne'),
 ('C08','Sione Taufa','PFL','Analyst','sione.taufa@example.com','+64 9 555 0701','Auckland'),
 ('C09','Jake Mercer','GSC','Portfolio manager','jake.mercer@example.com','+61 2 5550 0801','Sydney'),
 ('C10','Fiona Reid','CSE','Portfolio manager','fiona.reid@example.com','+61 7 5550 0901','Brisbane'),
 ('C11','Kiri Rangi','RCL','Portfolio manager','kiri.rangi@example.com','+64 9 555 1101','Auckland'),
 ('C12','Daniel Frost','SIP','Portfolio manager','daniel.frost@example.com','+61 3 5550 1201','Melbourne'),
 ('C13','Mei Tan','SIP','Analyst','mei.tan@example.com','+61 3 5550 1202','Melbourne'),
 ('C14','Lachlan Price','AVF','Portfolio manager','lachlan.price@example.com','+61 2 5550 1301','Sydney'),
 ('C15','Emma Hughes','HGS','Portfolio manager','emma.hughes@example.com','+44 20 5550 1401','London'),
 ('C16','Alex Lin','HSS','Analyst','alex.lin@example.com','+61 2 5550 1501','Sydney')
) v(code,name,inst,role,email,phone,city) join institutions i on i.code=v.inst
on conflict (code) do nothing;

insert into capital(as_at,shares_on_issue,note) values (current_date - 400, 412500000, 'Shares on issue') on conflict (as_at) do nothing;

insert into registers(as_at,source,note) values
 (current_date - 35,'registry','Monthly register and beneficial ownership analysis'),
 (current_date - 7,'registry','Monthly register and beneficial ownership analysis')
on conflict (as_at) do nothing;

insert into holdings(as_at,institution_id,shares)
select current_date - v.ago,i.id,v.shares from (values
 ('TPC',35,21500000),('TPC',7,27225000),
 ('SMI',35,22000000),('SMI',7,22275000),
 ('KSF',35,19800000),('KSF',7,21862500),
 ('BHA',35,23100000),('BHA',7,16087500),
 ('ILP',35,9500000),('ILP',7,11550000),
 ('NFO',35,4950000),('NFO',7,4950000),
 ('PFL',35,3712500),('PFL',7,3712500),
 ('GSC',35,2475000),('GSC',7,1650000),
 ('CSE',35,8662500),('CSE',7,8662500),
 ('WIF',35,6187500),('WIF',7,6187500),
 ('RCL',35,4125000)
) v(code,ago,shares) join institutions i on i.code=v.code
on conflict (as_at,institution_id) do nothing;

insert into notices(institution_id,lodged_on,kind,shares,ref)
select i.id,current_date - v.ago,v.kind,v.shares,v.ref from (values
 ('TPC',300,'became',21040000,'Form 603, Tasman Peak Capital'),
 ('SMI',200,'became',21450000,'Form 603, Southern Meridian Investors'),
 ('BHA',150,'became',23100000,'Form 603, Blue Harbour Asset Management')
) v(code,ago,kind,shares,ref) join institutions i on i.code=v.code
where not exists (select 1 from notices n where n.institution_id=i.id and n.lodged_on=current_date - v.ago);

insert into materials(code,title,released_on,announcement_ref) values
 ('MAT-FY26','FY26 results presentation',current_date - 75,'FY26 results presentation'),
 ('MAT-NZ','New Zealand investor deck',null,null),
 ('MAT-ID','Investor day preview',null,null)
on conflict (code) do nothing;

insert into roadshows(code,name,city,starts_on,ends_on,purpose,host_broker) values
 ('R-FY26','FY26 results roadshow','Sydney and Melbourne',current_date - 73,current_date - 70,'results','Ellerslie Partners'),
 ('R-NZ','New Zealand non-deal roadshow','Auckland',current_date - 60,current_date - 59,'non-deal','Kauri Markets')
on conflict (code) do nothing;

insert into events(code,kind,title,period_end,on_date,lodged_on,notice_sent_on,blackout) values
 ('HY26','half-year results','HY26 half-year results',current_date - 313,current_date - 230,current_date - 230,null,true),
 ('FY26','full-year results','FY26 full-year results',current_date - 130,current_date - 75,current_date - 75,null,true),
 ('Q1FY27','quarterly','Q1 FY27 quarterly activities and cash flow report',current_date - 36,current_date + 2,null,null,true),
 ('AGM26','agm','2026 annual general meeting',current_date - 130,current_date + 14,null,current_date - 10,false),
 ('INVDAY','investor day','Investor day, Hamilton plant',null,current_date + 40,null,null,false),
 ('HY27','half-year results','HY27 half-year results',(current_date - 130 + interval '6 months')::date,(current_date - 130 + interval '6 months')::date + 55,null,null,true)
on conflict (code) do nothing;

insert into meetings(code,held_on,starts,kind,institution_id,roadshow_id,material_id,city,status,cancel_reason,notes,sentiment,themes,noted_on)
select v.code,current_date + v.d,v.starts::time,v.kind,i.id,r.id,mt.id,v.city,v.status,v.reason,v.notes,v.sentiment,v.themes::text[],
  case when v.notes is not null then current_date + v.d + 1 end
from (values
 ('M1001',-228,'09:00','one-on-one','TPC',null,null,'Sydney','held',null,'Comfortable with the half. Pushed on second half guidance and whether margins hold if resin prices rise.','positive','{guidance,margins}'),
 ('M1002',-227,'11:00','one-on-one','SMI',null,null,'Melbourne','held',null,'Wants debt below 1.5 times EBITDA before any acquisition. Asked about guidance range width.','neutral','{debt,guidance}'),
 ('M1003',-227,'14:00','group','BHA',null,null,'Sydney','held',null,'Critical of the net debt increase. Thinks guidance is too wide.','negative','{debt,guidance}'),
 ('M1004',-225,'10:00','call','KSF',null,null,null,'held',null,'Short call on refinancing timing.','neutral','{debt}'),
 ('M1005',-215,'10:00','one-on-one','NFO',null,null,'Melbourne','held',null,'Long term holder, wants the dividend kept. No change to position planned.','neutral','{dividend}'),
 ('M1006',-205,'13:00','one-on-one','CSE',null,null,'Brisbane','held',null,'Likes the export growth story. Asked for a plant visit next year.','positive','{growth}'),
 ('M1030',-150,'15:00','call','SIP',null,null,null,'held',null,'Introductory call. Small cap growth fund building a packaging position.','neutral','{guidance}'),
 ('M1010',-73,'08:30','one-on-one','TPC','R-FY26','MAT-FY26','Sydney','held',null,'Very positive on the margin recovery. Asked for the segment margin bridge. Interested in the Hamilton acquisition pipeline.','positive','{margins,guidance,acquisition}'),
 ('M1011',-73,'13:00','one-on-one','SIP','R-FY26','MAT-FY26','Sydney','held',null,'Liked the margin story. Would want to see the Hamilton plant before buying.','positive','{margins,acquisition}'),
 ('M1012',-72,'09:00','one-on-one','BHA','R-FY26','MAT-FY26','Sydney','held',null,'Still worried about debt. Thinks second half margins are optimistic.','negative','{margins,debt}'),
 ('M1013',-72,'12:00','group','GSC','R-FY26','MAT-FY26','Sydney','held',null,'Broker lunch, six funds. Questions on margins only.','neutral','{margins}'),
 ('M1014',-71,'10:00','one-on-one','KSF','R-FY26','MAT-FY26','Sydney','held',null,'Supportive. Asked how guidance was built.','positive','{guidance,margins}'),
 ('M1015',-70,'09:30','one-on-one','SMI','R-FY26','MAT-FY26','Melbourne','held',null,'Wants clarity on capital management if the acquisition does not go ahead.','neutral','{guidance,"capital management"}'),
 ('M1016',-70,'14:00','one-on-one','AVF','R-FY26','MAT-FY26','Melbourne','held',null,'Interested at a lower price. Asked for the acquisition integration timeline.','neutral','{acquisition,margins}'),
 ('M1040',-68,'16:00','call','GSC',null,null,null,'held',null,'Asked about the short interest and the index review.','neutral','{"index inclusion"}'),
 ('M1041',-64,'16:00','call','GSC',null,null,null,'held',null,'Asked again about the acquisition timing.','neutral','{acquisition}'),
 ('M1020',-60,'09:00','one-on-one','ILP','R-NZ','MAT-NZ','Auckland','held',null,'Keen on the NZ plant expansion. Will add on weakness.','positive','{acquisition,guidance}'),
 ('M1021',-60,'13:00','one-on-one','RCL','R-NZ','MAT-NZ','Auckland','held',null,'Does not like debt funding an acquisition. May reduce.','negative','{acquisition,debt}'),
 ('M1022',-59,'10:00','group','PFL','R-NZ','MAT-NZ','Auckland','held',null,'Income investors, focused on the dividend.','neutral','{dividend,margins}'),
 ('M1042',-50,'16:00','call','GSC',null,null,null,'held',null,'Short call on trading conditions.','neutral','{margins}'),
 ('M1043',-45,'16:00','call','GSC',null,null,null,'held',null,'Asked whether the AGM will update guidance.','neutral','{guidance}'),
 ('M1044',-40,'16:00','call','GSC',null,null,null,'held',null,null,null,'{}'),
 ('M1053',-20,'09:00','call','HGS',null,null,null,'cancelled','investor rescheduled',null,null,'{}'),
 ('M1031',-5,'10:00','one-on-one','SIP',null,null,'Melbourne','held',null,'Plant visit planning. No new numbers discussed.','positive','{acquisition}'),
 ('M1050',1,'11:00','call','AVF',null,null,null,'booked',null,null,null,'{}'),
 ('M1051',6,'09:00','group','SMI',null,null,'Melbourne','booked',null,null,null,'{}'),
 ('M1052',9,'10:00','one-on-one','TPC',null,'MAT-ID','Sydney','booked',null,null,null,'{}')
) v(code,d,starts,kind,inst,roadshow,material,city,status,reason,notes,sentiment,themes)
join institutions i on i.code=v.inst
left join roadshows r on r.code=v.roadshow
left join materials mt on mt.code=v.material
on conflict (code) do nothing;

insert into meeting_team(meeting_id,team_id)
select m.id,t.id from (values
 ('M1001','HM'),('M1001','RP'),('M1002','HM'),('M1002','RP'),('M1003','HM'),('M1003','LT'),('M1004','RP'),('M1005','HM'),('M1005','LT'),('M1006','HM'),
 ('M1030','LT'),('M1010','HM'),('M1010','RP'),('M1011','HM'),('M1011','RP'),('M1012','HM'),('M1012','RP'),('M1013','HM'),('M1013','RP'),('M1014','HM'),('M1014','RP'),
 ('M1015','HM'),('M1015','RP'),('M1016','RP'),('M1016','LT'),('M1040','HM'),('M1041','HM'),('M1020','HM'),('M1020','LT'),('M1021','HM'),('M1021','LT'),('M1022','HM'),('M1022','LT'),
 ('M1042','HM'),('M1043','HM'),('M1044','HM'),('M1053','LT'),('M1031','HM'),('M1050','RP'),('M1051','HM'),('M1051','RP'),('M1052','HM'),('M1052','RP')
) v(meeting,team) join meetings m on m.code=v.meeting join team t on t.code=v.team
on conflict do nothing;

insert into meeting_contacts(meeting_id,contact_id)
select m.id,c.id from (values
 ('M1001','C01'),('M1002','C03'),('M1003','C05'),('M1004','C04'),('M1005','C07'),('M1006','C10'),('M1030','C13'),('M1010','C01'),('M1010','C02'),('M1011','C12'),
 ('M1012','C05'),('M1013','C09'),('M1014','C04'),('M1015','C03'),('M1016','C14'),('M1040','C09'),('M1041','C09'),('M1020','C06'),('M1021','C11'),('M1022','C08'),
 ('M1042','C09'),('M1043','C09'),('M1044','C09'),('M1053','C15'),('M1031','C12'),('M1031','C13'),('M1050','C14'),('M1051','C03'),('M1052','C01')
) v(meeting,contact) join meetings m on m.code=v.meeting join contacts c on c.code=v.contact
on conflict do nothing;

insert into follow_ups(code,meeting_id,institution_id,owner_id,action,due_on,done_on)
select v.code,m.id,m.institution_id,t.id,v.action,current_date + v.due,case when v.done is not null then current_date + v.done end from (values
 ('FU101','M1010','RP','Send the segment margin bridge',-65,null),
 ('FU102','M1011','LT','Arrange a visit to the Hamilton plant',5,null),
 ('FU103','M1016','RP','Share the acquisition integration timeline once it is announced',-50,null),
 ('FU104','M1012','RP','Send the debt maturity profile',-66,-66),
 ('FU105','M1020','LT','Add to the investor day invitation list',20,null)
) v(code,meeting,owner,action,due,done) join meetings m on m.code=v.meeting join team t on t.code=v.owner
on conflict (code) do nothing;

insert into coverage(code,broker,analyst,rating,target_cents,eps_fy1_cents,eps_fy2_cents,updated_on) values
 ('HSS','Harbour Street Securities','Alex Lin','buy',285,18.2,21.0,current_date - 20),
 ('ELP','Ellerslie Partners','Rachel Doyle','buy',310,19.0,22.5,current_date - 6),
 ('CLR','Canning Lane Research','Sam Okafor','hold',240,17.1,18.9,current_date - 60),
 ('SBE','Southbank Equities','Jay Patel','buy',295,18.5,21.4,current_date - 74),
 ('KMK','Kauri Markets','Tama Ngata','sell',190,15.8,16.2,current_date - 210)
on conflict (code) do nothing;

insert into prices(on_date,close_cents) values
 (current_date - 75,219),(current_date - 35,241),(current_date - 8,232),(current_date - 1,228)
on conflict (on_date) do nothing;

insert into notes(institution_id,body)
select i.id,'Olivia prefers mornings and wants the CFO in every results meeting.' from institutions i
where i.code='TPC' and not exists (select 1 from notes n where n.institution_id=i.id);
