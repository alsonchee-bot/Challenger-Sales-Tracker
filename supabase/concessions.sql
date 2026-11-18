-- Challenger concession investment tracker (additive: new table + functions only).
-- Admin-only. Amounts are monthly fixed concession fees (currency assumed SGD).
create table if not exists public.concessions (
  id bigint generated always as identity primary key,
  brand text not null check (length(brand) between 1 and 40),
  outlet text not null check (length(outlet) between 1 and 80),
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  end_date date,
  notes text,
  updated_at timestamptz not null default now(),
  unique (brand, outlet)
);
alter table public.concessions enable row level security;
-- No policies on purpose: all access goes through the admin-checked functions below.

create or replace function public.concession_list()
returns setof public.concessions language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can view concessions'; end if;
  return query select * from public.concessions order by brand, outlet;
end $$;

create or replace function public.concession_save(p jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare b text; o text;
begin
  if not public.is_admin() then raise exception 'Only an admin can change concessions'; end if;
  b := upper(trim(p->>'brand')); o := trim(p->>'outlet');
  if b is null or o is null or b = '' or o = '' then raise exception 'Brand and outlet are required'; end if;
  insert into public.concessions(brand, outlet, monthly_fee, end_date, notes)
  values (b, o, coalesce((p->>'monthly_fee')::numeric,0), nullif(p->>'end_date','')::date, left(p->>'notes',500))
  on conflict (brand, outlet) do update
    set monthly_fee = excluded.monthly_fee, end_date = excluded.end_date, notes = excluded.notes, updated_at = now();
end $$;

create or replace function public.concession_delete(p_id bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can remove concessions'; end if;
  delete from public.concessions where id = p_id;
end $$;

revoke all on function public.concession_list(), public.concession_save(jsonb), public.concession_delete(bigint) from public, anon;
grant execute on function public.concession_list(), public.concession_save(jsonb), public.concession_delete(bigint) to authenticated;

insert into public.concessions(brand, outlet, monthly_fee, end_date) values
 ('MAZER','Bugis Flagship',1000,'2026-04-30'),('MAZER','NEX',500,'2027-12-31'),('MAZER','Funan',1000,'2027-12-31'),
 ('MAZER','PLQ',500,'2027-09-30'),('MAZER','JEM',600,'2027-09-30'),('MAZER','Jewel',600,'2027-10-31'),
 ('MAZER','Northpoint',300,'2027-03-31'),('MAZER','TM',300,'2027-08-31'),('MAZER','Vivo',300,'2026-03-31'),
 ('MAZER','Tiong Bahru',0,null),('MAZER','Jurong Point',500,'2026-11-01'),
 ('SUDIO','Jewel',300,null),('SUDIO','Vivo',300,null),('SUDIO','NEX',500,'2026-12-31')
on conflict (brand, outlet) do nothing;
