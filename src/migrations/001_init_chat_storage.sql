create extension if not exists pgcrypto;

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  metadata_id integer not null,
  name text not null,
  system_message text not null,
  metadata_fields jsonb not null,
  folder_id uuid references folders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text,
  parsed_content jsonb,
  execution_data jsonb,
  error_response jsonb,
  open_ai_items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_folder_id on conversations(folder_id);
create index if not exists idx_conversations_created_at on conversations(created_at desc);
create index if not exists idx_messages_conversation_id on app_messages(conversation_id);
create index if not exists idx_messages_created_at on app_messages(created_at asc);
