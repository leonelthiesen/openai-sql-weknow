create table if not exists app_users (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table folders
  add column if not exists owner_user_id text not null references app_users(id);

alter table conversations
  add column if not exists owner_user_id text not null references app_users(id);

alter table app_messages
  add column if not exists user_id text not null references app_users(id);

create table if not exists conversation_shares (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  shared_with_user_id text not null references app_users(id),
  permission text not null check (permission in ('READ_ONLY')),
  created_at timestamptz not null default now(),
  unique (conversation_id, shared_with_user_id)
);

create index if not exists idx_folders_owner_user_id on folders(owner_user_id);
create index if not exists idx_conversations_owner_user_id on conversations(owner_user_id);
create index if not exists idx_messages_user_id on app_messages(user_id);
create index if not exists idx_conversation_shares_conversation_id on conversation_shares(conversation_id);
create index if not exists idx_conversation_shares_shared_with_user_id on conversation_shares(shared_with_user_id);
