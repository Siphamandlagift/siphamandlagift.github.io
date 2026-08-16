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