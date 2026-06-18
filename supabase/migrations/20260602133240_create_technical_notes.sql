create table technical_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  tags text[] default '{}',
  content text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
