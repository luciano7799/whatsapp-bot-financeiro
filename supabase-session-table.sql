-- Cole isso no SQL Editor do Supabase para criar a tabela de sessão
create table if not exists whatsapp_session (
  key   text primary key,
  value text not null
);

alter table whatsapp_session disable row level security;
