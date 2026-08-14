-- Billing migration: subscription status + plan limits
-- Run this once against your PostgreSQL database after multitenant-lms.sql

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade unique,
  status text not null check (status in ('active', 'inactive', 'suspended')) default 'inactive',
  activated_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_company_id on subscriptions(company_id);

-- Automatically create an inactive subscription row whenever a new company registers.
create or replace function create_subscription_on_company_insert()
returns trigger as $$
begin
  insert into subscriptions (company_id, status)
  values (new.id, 'inactive');
  return new;
end;
$$ language plpgsql;

drop trigger if exists company_subscription_trigger on companies;
create trigger company_subscription_trigger
  after insert on companies
  for each row execute function create_subscription_on_company_insert();

-- Backfill any existing companies that don't have a subscription row yet.
-- Seed data company gets 'active' so demo credentials keep working.
insert into subscriptions (company_id, status, activated_at)
select id, 'active', now() from companies
on conflict (company_id) do nothing;
