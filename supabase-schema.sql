-- Execute este SQL no Supabase: SQL Editor → New query → Run
-- Depois: Authentication → Policies (já criadas abaixo via RLS)

create table if not exists prayer_slots (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  slot_time time not null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  cell text not null check (char_length(trim(cell)) between 2 and 80),
  created_at timestamptz not null default now()
);

-- Migração: se a tabela já existia com UNIQUE (event_date, slot_time), remova:
-- alter table prayer_slots drop constraint if exists prayer_slots_event_date_slot_time_key;

create index if not exists prayer_slots_event_date_idx on prayer_slots (event_date);
create index if not exists prayer_slots_slot_lookup_idx
  on prayer_slots (event_date, slot_time);

alter table prayer_slots enable row level security;

-- Qualquer visitante pode ler a agenda
create policy "Leitura pública"
  on prayer_slots for select
  to anon, authenticated
  using (true);

-- Qualquer visitante pode reservar um horário
create policy "Inserção pública"
  on prayer_slots for insert
  to anon, authenticated
  with check (true);

-- Sem update/delete públicos (evita alguém apagar a agenda de outros)
