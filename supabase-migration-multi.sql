-- Execute no Supabase SQL Editor se a tabela prayer_slots já existir
-- com a restrição UNIQUE (event_date, slot_time).

alter table prayer_slots
  drop constraint if exists prayer_slots_event_date_slot_time_key;

create index if not exists prayer_slots_slot_lookup_idx
  on prayer_slots (event_date, slot_time);
