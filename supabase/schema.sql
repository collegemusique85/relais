-- =====================================================================
-- Relais : schéma pour l'option Supabase (PostgreSQL)
-- Ébauche technique testée sur PostgreSQL 16 avec un faux schéma « auth ».
-- À relire avant toute mise en service. AUCUNE donnée réelle ici.
--
-- Principes :
--  * La sécurité est dans la base (RLS), pas dans le site : le site est public.
--  * Les enseignants ne modifient jamais directement le planning : ils
--    appellent des fonctions (take_relais, propose_exchange…) qui appliquent
--    les règles en une seule transaction. C'est l'« arbitre ».
--  * La vie scolaire (2 comptes) est la seule à écrire dans le planning.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists private;   -- fonctions internes, non exposées par l'API

-- ---------------------------------------------------------------------
-- Référentiel (importé depuis l'emploi du temps)
-- ---------------------------------------------------------------------
create table public.staff (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique,                       -- lien vers auth.users après 1re connexion
  email        text unique not null,              -- adresse Saint-Gab (Entra ID)
  display_name text not null,                     -- « Mme Durand »
  civ          text check (civ in ('Mme', 'M.')),
  subject      text,
  role         text not null default 'enseignant'
               check (role in ('enseignant', 'vie_scolaire', 'direction'))
);

create table public.classes (
  code  text primary key,                         -- '501'
  level text not null check (level in ('6', '5', '4', '3'))
);

create table public.slot_times (                  -- horaires réels, par jour
  dow   smallint not null check (dow between 1 and 5),   -- 1 = lundi
  slot  text     not null check (slot in ('M1','M2','M3','M4','S1','S2','S3','S4')),
  starts time    not null,
  ends   time    not null,
  primary key (dow, slot)
);

create table public.lessons (                     -- emploi du temps de base
  id         bigint generated always as identity primary key,
  class_code text not null references public.classes,
  group_code text,                                -- 'ESP2', 'SOUMETH'… (cours en groupe)
  subject    text not null,
  teacher_id uuid not null references public.staff,
  dow        smallint not null check (dow between 1 and 5),
  slot       text not null,
  half       text check (half in ('d1', 'd2')),   -- cours d'1h20 : demi-créneau
  parity     text not null default 'toutes' check (parity in ('toutes', 'paire', 'impaire')),
  room       text
);
create index on public.lessons (teacher_id, dow, slot);
create index on public.lessons (class_code, dow, slot);

-- ---------------------------------------------------------------------
-- Le fil (écrit par la vie scolaire)
-- ---------------------------------------------------------------------
create table public.absences (
  id         bigint generated always as identity primary key,
  teacher_id uuid not null references public.staff,
  day        date not null,
  slots      text[] not null,
  created_by uuid references public.staff,
  created_at timestamptz not null default now()
);

create table public.events (                      -- sorties, temps forts, infos
  id              bigint generated always as identity primary key,
  day             date not null,
  title           text not null,
  kind            text not null check (kind in ('sortie', 'tempsfort', 'info', 'journee')),
  classes         text[] not null default '{}',
  slots           text[] not null,
  accompagnateurs uuid[] not null default '{}',
  room            text,
  counts_in_stats boolean not null default true,
  created_by      uuid references public.staff,
  created_at      timestamptz not null default now()
);

create table public.lines (                       -- un cours touché = une ligne du fil
  id            bigint generated always as identity primary key,
  day           date not null,
  slot          text not null,
  class_code    text not null references public.classes,
  subject       text,
  teacher_id    uuid references public.staff,     -- prof absent / accompagnateur
  room          text,
  reason        text not null check (reason in ('absence', 'accompagnement', 'inversion')),
  absence_id    bigint references public.absences on delete cascade,
  event_id      bigint references public.events on delete cascade,
  parent_line   bigint references public.lines on delete cascade,
  sol_kind      text check (sol_kind in ('relais', 'inversion', 'etude', 'self')),
  sol_teacher   uuid references public.staff,     -- remplaçant ou prof de l'inversion
  sol_subject   text,
  sol_room      text,
  taken_at      timestamptz,
  taken_prio    boolean,
  comment       text,                             -- PACTE, RCD… (choisi par la vie scolaire)
  updated_at    timestamptz not null default now()
);
create index on public.lines (day, slot);
create index on public.lines (sol_teacher);

create table public.exchanges (
  id          bigint generated always as identity primary key,
  class_code  text not null references public.classes,
  a_teacher   uuid not null references public.staff,   -- celui qui propose
  a_day date not null, a_slot text not null, a_subject text, a_room text,
  b_teacher   uuid not null references public.staff,   -- celui qui accepte ou refuse
  b_day date not null, b_slot text not null, b_subject text, b_room text,
  status      text not null default 'propose' check (status in ('propose', 'accepte', 'refuse', 'annule')),
  created_at  timestamptz not null default now()
);

create table public.room_requests (
  id         bigint generated always as identity primary key,
  teacher_id uuid not null references public.staff,
  day date not null, slot text not null, class_code text not null,
  from_room  text, room text not null, why text,
  status     text not null default 'attente' check (status in ('attente', 'valide', 'refuse')),
  created_at timestamptz not null default now()
);

create table public.notifications (               -- relayées vers Teams ou mail
  id         bigint generated always as identity primary key,
  recipient  uuid references public.staff,        -- une personne…
  to_role    text check (to_role in ('vie_scolaire', 'direction')),  -- …ou un rôle
  kind       text not null default 'info',
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  check (recipient is not null or to_role is not null)
);

create table public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings values
  ('etude_capacity', '{"Pascal 2": 3, "Foyer 6/5": 2, "Foyer 4/3": 2, "CDI": 1}'),
  ('first_week_parity', '"impaire"');

-- ---------------------------------------------------------------------
-- Fonctions d'aide (schéma privé, non exposé)
-- ---------------------------------------------------------------------
create or replace function private.me() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.staff s where s.user_id = (select auth.uid())
$$;

create or replace function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select s.role from public.staff s where s.user_id = (select auth.uid())
$$;

create or replace function private.is_vs() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'vie_scolaire', false)
$$;

create or replace function private.is_dir() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('direction', 'vie_scolaire'), false)
$$;

-- Parité ISO de la semaine (semaines paires / impaires de l'emploi du temps)
create or replace function private.parity(d date) returns text
language sql immutable set search_path = '' as $$
  select case when extract(week from d)::int % 2 = 0 then 'paire' else 'impaire' end
$$;

-- Le prof a-t-il cette classe ? (règle de priorité ; pour un cours en groupe,
-- il faut la même matière et le même niveau)
create or replace function private.has_class(t uuid, cls text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lessons l where l.teacher_id = t and l.class_code = cls)
$$;

-- Le prof est-il libre à ce créneau, compte tenu de tout ce qui a changé ?
create or replace function private.is_free(t uuid, d date, s text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_dow smallint := extract(isodow from d)::smallint;
begin
  -- absent ou accompagnateur
  if exists (select 1 from public.absences a where a.teacher_id = t and a.day = d and s = any (a.slots)) then return false; end if;
  if exists (select 1 from public.events e where e.day = d and s = any (e.slots) and t = any (e.accompagnateurs)) then return false; end if;
  -- relais ou inversion déjà confiés ce créneau
  if exists (select 1 from public.lines l where l.day = d and l.slot = s and l.sol_teacher = t and l.sol_kind in ('relais', 'inversion')) then return false; end if;
  -- échange accepté qui le place sur ce créneau
  if exists (select 1 from public.exchanges x where x.status = 'accepte' and
       ((x.b_teacher = t and x.a_day = d and x.a_slot = s) or (x.a_teacher = t and x.b_day = d and x.b_slot = s))) then return false; end if;
  -- cours de base, sauf s'il est annulé (classe en sortie, cours échangé, inversion qui l'a déplacé)
  return not exists (
    select 1 from public.lessons l
    where l.teacher_id = t and l.dow = v_dow and l.slot = s
      and l.parity in ('toutes', private.parity(d))
      and not exists (select 1 from public.events e where e.day = d and s = any (e.slots) and e.kind <> 'info'
                      and (e.kind = 'journee' or l.class_code = any (e.classes)))
      and not exists (select 1 from public.exchanges x where x.status = 'accepte'
                      and ((x.a_teacher = t and x.a_day = d and x.a_slot = s) or (x.b_teacher = t and x.b_day = d and x.b_slot = s)))
      and not exists (select 1 from public.lines li where li.day = d and li.slot = s and li.class_code = l.class_code
                      and li.reason = 'inversion' and li.teacher_id = t)
  );
end $$;

-- Échéance des inscriptions : la veille à 17h, heure de Paris
create or replace function private.deadline(d date) returns timestamptz
language sql immutable set search_path = '' as $$
  select ((d - 1) + time '17:00') at time zone 'Europe/Paris'
$$;

create or replace function private.notify(rcpt uuid, role text, k text, msg text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (recipient, to_role, kind, body) values (rcpt, role, k, msg)
$$;

-- ---------------------------------------------------------------------
-- L'arbitre : fonctions appelées par les enseignants
-- ---------------------------------------------------------------------
create or replace function public.take_relais(p_line bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.me();
  l public.lines;
  my_prio boolean;
  holder_prio boolean;
  holder uuid;
  who text;
begin
  if me is null then raise exception 'Compte inconnu'; end if;
  select * into l from public.lines where id = p_line for update;      -- verrou : un seul gagnant
  if not found or l.sol_kind is distinct from 'relais' then raise exception 'Ce créneau n''est pas ouvert aux relais'; end if;
  if now() >= private.deadline(l.day) then raise exception 'Les inscriptions sont closes (la veille à 17h)'; end if;
  if l.sol_teacher = me then return 'deja_vous'; end if;
  if not private.is_free(me, l.day, l.slot) then raise exception 'Vous n''êtes pas libre sur ce créneau'; end if;
  my_prio := private.has_class(me, l.class_code);
  select display_name into who from public.staff where id = me;
  if l.sol_teacher is null then
    update public.lines set sol_teacher = me, taken_at = now(), taken_prio = my_prio, updated_at = now() where id = p_line;
    perform private.notify(null, 'vie_scolaire', 'info', format('%s prend le relais : %s, %s en %s.', who, l.class_code, to_char(l.day, 'DD/MM'), l.slot));
    return 'pris';
  end if;
  holder := l.sol_teacher;
  holder_prio := private.has_class(holder, l.class_code);
  if my_prio and not holder_prio then
    update public.lines set sol_teacher = me, taken_at = now(), taken_prio = true, updated_at = now() where id = p_line;
    perform private.notify(holder, null, 'warn', format('%s, qui a la %s, a repris le relais du %s en %s. Vous n''êtes plus attendu. Merci pour votre proposition !', who, l.class_code, to_char(l.day, 'DD/MM'), l.slot));
    perform private.notify(null, 'vie_scolaire', 'info', format('%s (prioritaire) a repris un relais : %s, %s en %s.', who, l.class_code, to_char(l.day, 'DD/MM'), l.slot));
    return 'repris';
  end if;
  raise exception 'Ce relais est déjà pris';
end $$;

create or replace function public.withdraw_relais(p_line bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.me(); l public.lines;
begin
  select * into l from public.lines where id = p_line for update;
  if l.sol_teacher is distinct from me or l.sol_kind <> 'relais' then raise exception 'Ce relais n''est pas le vôtre'; end if;
  if now() >= private.deadline(l.day) then raise exception 'Trop tard pour se désister : contactez la vie scolaire'; end if;
  update public.lines set sol_teacher = null, taken_at = null, taken_prio = null, updated_at = now() where id = p_line;
  perform private.notify(null, 'vie_scolaire', 'warn', format('Désistement sur le relais %s, %s en %s : de nouveau ouvert.', l.class_code, to_char(l.day, 'DD/MM'), l.slot));
end $$;

create or replace function public.propose_exchange(p_a_day date, p_a_slot text, p_b_teacher uuid, p_b_day date, p_b_slot text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.me();
  la public.lessons; lb public.lessons; new_id bigint; who text;
begin
  select * into la from public.lessons l where l.teacher_id = me and l.dow = extract(isodow from p_a_day) and l.slot = p_a_slot
    and l.parity in ('toutes', private.parity(p_a_day)) limit 1;
  select * into lb from public.lessons l where l.teacher_id = p_b_teacher and l.dow = extract(isodow from p_b_day) and l.slot = p_b_slot
    and l.parity in ('toutes', private.parity(p_b_day)) and l.class_code = la.class_code limit 1;
  if la.id is null or lb.id is null then raise exception 'Les deux cours doivent concerner la même classe'; end if;
  if not private.is_free(p_b_teacher, p_a_day, p_a_slot) or not private.is_free(me, p_b_day, p_b_slot) then
    raise exception 'L''un de vous deux n''est pas libre sur le créneau de l''autre';
  end if;
  insert into public.exchanges (class_code, a_teacher, a_day, a_slot, a_subject, a_room, b_teacher, b_day, b_slot, b_subject, b_room)
  values (la.class_code, me, p_a_day, p_a_slot, la.subject, la.room, p_b_teacher, p_b_day, p_b_slot, lb.subject, lb.room)
  returning id into new_id;
  select display_name into who from public.staff where id = me;
  perform private.notify(p_b_teacher, null, 'echange', format('%s vous propose un échange avec la %s : son heure du %s en %s contre la vôtre du %s en %s.',
    who, la.class_code, to_char(p_a_day, 'DD/MM'), p_a_slot, to_char(p_b_day, 'DD/MM'), p_b_slot));
  return new_id;
end $$;

create or replace function public.answer_exchange(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.me(); x public.exchanges;
begin
  select * into x from public.exchanges where id = p_id for update;
  if x.b_teacher is distinct from me or x.status <> 'propose' then raise exception 'Proposition introuvable'; end if;
  if p_accept and (not private.is_free(x.b_teacher, x.a_day, x.a_slot) or not private.is_free(x.a_teacher, x.b_day, x.b_slot)) then
    raise exception 'L''emploi du temps a changé : cet échange n''est plus possible';
  end if;
  update public.exchanges set status = case when p_accept then 'accepte' else 'refuse' end where id = p_id;
  perform private.notify(x.a_teacher, null, case when p_accept then 'ok' else 'warn' end,
    format('Votre proposition d''échange avec la %s a été %s.', x.class_code, case when p_accept then 'acceptée' else 'refusée' end));
  if p_accept then
    perform private.notify(null, 'vie_scolaire', 'info', format('Pour information : échange avec la %s, %s en %s ↔ %s en %s.',
      x.class_code, to_char(x.a_day, 'DD/MM'), x.a_slot, to_char(x.b_day, 'DD/MM'), x.b_slot));
  end if;
end $$;

-- Statistiques : heures manquées par classe (tout le monde) et par discipline (direction)
create or replace function public.stats_by_class() returns table (class_code text, hours bigint, sortie bigint)
language sql stable security definer set search_path = '' as $$
  select l.class_code, count(*), count(*) filter (where e.kind = 'sortie')
  from public.events e
  cross join lateral unnest(e.slots) as s(slot)
  join public.lessons l on l.dow = extract(isodow from e.day) and l.slot = s.slot
       and l.parity in ('toutes', private.parity(e.day))
       and (e.kind = 'journee' or l.class_code = any (e.classes))
  where e.counts_in_stats and e.kind <> 'info'
  group by l.class_code
$$;

create or replace function public.stats_by_subject(p_class text) returns table (subject text, hours bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_dir() then raise exception 'Réservé à la direction'; end if;
  return query
    select l.subject, count(*)
    from public.events e
    cross join lateral unnest(e.slots) as s(slot)
    join public.lessons l on l.dow = extract(isodow from e.day) and l.slot = s.slot
         and l.parity in ('toutes', private.parity(e.day)) and l.class_code = p_class
         and (e.kind = 'journee' or l.class_code = any (e.classes))
    where e.counts_in_stats and e.kind <> 'info'
    group by l.subject order by 2 desc;
end $$;

-- ---------------------------------------------------------------------
-- Sécurité ligne par ligne (RLS)
-- ---------------------------------------------------------------------
alter table public.staff         enable row level security;
alter table public.classes       enable row level security;
alter table public.slot_times    enable row level security;
alter table public.lessons       enable row level security;
alter table public.absences      enable row level security;
alter table public.events        enable row level security;
alter table public.lines         enable row level security;
alter table public.exchanges     enable row level security;
alter table public.room_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.settings      enable row level security;

-- Personne sans compte Saint-Gab ne voit rien : aucune règle pour « anon ».
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to authenticated;
-- Les règles RLS appellent les fonctions du schéma privé (non exposé par l'API).
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.absences, public.events, public.lines, public.settings to authenticated;
grant insert on public.room_requests to authenticated;
grant update on public.room_requests, public.notifications to authenticated;
grant execute on function public.take_relais(bigint), public.withdraw_relais(bigint),
  public.propose_exchange(date, text, uuid, date, text), public.answer_exchange(bigint, boolean),
  public.stats_by_class(), public.stats_by_subject(text) to authenticated;

-- Référentiel : lecture pour tout compte du personnel
create policy "personnel lit le référentiel" on public.staff      for select to authenticated using (private.me() is not null);
create policy "personnel lit les classes"    on public.classes    for select to authenticated using (private.me() is not null);
create policy "personnel lit les horaires"   on public.slot_times for select to authenticated using (private.me() is not null);
create policy "personnel lit l'EDT"          on public.lessons    for select to authenticated using (private.me() is not null);
create policy "personnel lit les réglages"   on public.settings   for select to authenticated using (private.me() is not null);

-- Le fil : tout le personnel lit, seule la vie scolaire écrit
create policy "lecture du fil (absences)" on public.absences for select to authenticated using (private.me() is not null);
create policy "lecture du fil (événements)" on public.events for select to authenticated using (private.me() is not null);
create policy "lecture du fil (lignes)" on public.lines for select to authenticated using (private.me() is not null);
create policy "vie scolaire écrit les absences" on public.absences for all to authenticated using ((select private.is_vs())) with check ((select private.is_vs()));
create policy "vie scolaire écrit les événements" on public.events for all to authenticated using ((select private.is_vs())) with check ((select private.is_vs()));
create policy "vie scolaire écrit les lignes" on public.lines for all to authenticated using ((select private.is_vs())) with check ((select private.is_vs()));
create policy "vie scolaire règle" on public.settings for all to authenticated using ((select private.is_vs())) with check ((select private.is_vs()));

-- Échanges : visibles par les deux collègues et la vie scolaire ; écrits uniquement via les fonctions
create policy "échanges visibles par les intéressés" on public.exchanges for select to authenticated
  using (a_teacher = (select private.me()) or b_teacher = (select private.me()) or (select private.is_vs()));

-- Salles : chacun demande pour soi ; la vie scolaire valide
create policy "demandes de salle visibles" on public.room_requests for select to authenticated
  using (teacher_id = (select private.me()) or (select private.is_vs()));
create policy "demander une salle pour soi" on public.room_requests for insert to authenticated
  with check (teacher_id = (select private.me()) and status = 'attente');
create policy "vie scolaire valide les salles" on public.room_requests for update to authenticated
  using ((select private.is_vs())) with check ((select private.is_vs()));

-- Notifications : chacun les siennes (et celles de son rôle)
create policy "mes notifications" on public.notifications for select to authenticated
  using (recipient = (select private.me()) or to_role = (select private.my_role()));
create policy "marquer comme lu" on public.notifications for update to authenticated
  using (recipient = (select private.me()) or to_role = (select private.my_role()));

-- Lier le compte Supabase (connexion Entra ID) à la fiche du personnel, par l'adresse mail.
-- Un compte dont l'adresse n'est pas dans « staff » ne voit rien.
create or replace function private.link_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.staff set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;
create trigger link_staff after insert on auth.users for each row execute function private.link_staff();

-- Purge de fin d'année (à lancer en juillet, après export des statistiques)
create or replace function public.purge_annee() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_vs() then raise exception 'Réservé à la vie scolaire'; end if;
  delete from public.notifications; delete from public.room_requests; delete from public.exchanges;
  delete from public.lines; delete from public.absences; delete from public.events;
end $$;
grant execute on function public.purge_annee() to authenticated;
