alter table app_messages
  add column if not exists pivot_csv text;
