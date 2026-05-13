create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  license_type text not null check (license_type in ('starter', 'growth', 'enterprise')),
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'manager', 'learner')),
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint courses_company_title_unique unique (company_id, title)
);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  progress integer not null default 0 check (progress between 0 and 100),
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint enrollments_user_course_unique unique (user_id, course_id)
);

create index if not exists idx_users_company_id on users(company_id);
create index if not exists idx_courses_company_id on courses(company_id);
create index if not exists idx_enrollments_company_id on enrollments(company_id);
create index if not exists idx_enrollments_user_id on enrollments(user_id);
create index if not exists idx_enrollments_course_id on enrollments(course_id);

insert into companies (id, name, license_type)
values ('4d98e619-c671-46cc-a951-95c9dba5f0db', 'Acme Learning', 'enterprise')
on conflict (id) do nothing;

insert into users (id, name, email, password_hash, role, company_id)
values
  ('a89f15b7-b2cd-4095-b9a6-57cbfb1e1e6f', 'Ava Admin', 'admin@acme-learning.test', '$2b$10$bizcleZ7aiJhNq.ownPTmOyNE/ZD50aDm84.BFWXa3Yw806wQhTvm', 'admin', '4d98e619-c671-46cc-a951-95c9dba5f0db'),
  ('6df0afb6-9b3d-423d-93f1-448926ea3fd5', 'Mara Manager', 'manager@acme-learning.test', '$2b$10$X9.Cv2vGgTnBuNod4qAWP.cwtVGX4OZoiVR2zx7hrtJGrkcYVkSrS', 'manager', '4d98e619-c671-46cc-a951-95c9dba5f0db'),
  ('65ce74e8-3790-4f10-ae12-3812f6a728ea', 'Leo Learner', 'learner@acme-learning.test', '$2b$10$aiABm3UL0Ykl5nWFqvapf.iJiw4hdGEyHukZ18K80NsclgnZ9pu6m', 'learner', '4d98e619-c671-46cc-a951-95c9dba5f0db')
on conflict (id) do nothing;

insert into courses (id, title, company_id)
values
  ('2e989ec4-3da6-4e62-bc07-4d3408b2c1e8', 'Compliance Essentials', '4d98e619-c671-46cc-a951-95c9dba5f0db'),
  ('cf647283-fa29-4d58-86e3-d6cdf711de6d', 'Leadership Foundations', '4d98e619-c671-46cc-a951-95c9dba5f0db')
on conflict (id) do nothing;

insert into enrollments (id, user_id, course_id, progress, company_id)
values
  ('8dc0b8ed-ab3a-4928-aeb4-6ca4cc9f0648', '65ce74e8-3790-4f10-ae12-3812f6a728ea', '2e989ec4-3da6-4e62-bc07-4d3408b2c1e8', 35, '4d98e619-c671-46cc-a951-95c9dba5f0db'),
  ('c29b9f27-d8a4-4575-a0f4-7700052146ac', '65ce74e8-3790-4f10-ae12-3812f6a728ea', 'cf647283-fa29-4d58-86e3-d6cdf711de6d', 72, '4d98e619-c671-46cc-a951-95c9dba5f0db')
on conflict (id) do nothing;

-- Demo credentials for the seed above:
-- admin@acme-learning.test / Admin123!
-- manager@acme-learning.test / Manager123!
-- learner@acme-learning.test / Learner123!