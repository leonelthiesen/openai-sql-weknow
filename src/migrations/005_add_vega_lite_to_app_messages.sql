alter table app_messages
  add column if not exists chart_vega_lite text;
