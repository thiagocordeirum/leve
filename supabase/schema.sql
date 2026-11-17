-- =============================================================
-- Leve (antigo Sobra): tabelas, validações e regras de acesso (RLS)
-- Cole tudo no Supabase em SQL Editor > New query > Run.
-- Pode rodar de novo sem problema: o script é idempotente.
-- =============================================================

-- Plano de cada pessoa (salário, meta, custos fixos...)
create table if not exists public.perfis (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint perfis_config_objeto  check (jsonb_typeof(config) = 'object'),
  constraint perfis_config_tamanho check (pg_column_size(config) < 65536)
);

-- Gastos lançados
create table if not exists public.gastos (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id        text not null check (char_length(id) between 1 and 160),
  data      date not null,
  valor     numeric(12,2) not null check (valor >= 0 and valor < 10000000),
  cat       text not null check (cat in ('transporte','comida','lazer','compras','assinatura','familia','saude','outros')),
  fonte     text not null check (fonte in ('conta','cartao','vr','mob','caixinha')),
  descricao text not null default '' check (char_length(descricao) <= 200),
  criado    timestamptz not null default now(),
  primary key (user_id, id)
);

-- Movimentos da caixinha
create table if not exists public.caixinha (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null check (char_length(id) between 1 and 160),
  data    date not null,
  valor   numeric(14,2) not null check (abs(valor) < 100000000),
  tipo    text not null check (tipo in ('deposito','resgate','ajuste')),
  mes     text check (mes ~ '^\d{4}-\d{2}$'),
  nota    text not null default '' check (char_length(nota) <= 200),
  criado  timestamptz not null default now(),
  primary key (user_id, id),
  constraint caixinha_sinal check (
    (tipo = 'deposito' and valor > 0) or
    (tipo = 'resgate'  and valor < 0) or
    (tipo = 'ajuste')
  )
);

-- Gasto pago com resgate da caixinha (fonte 'caixinha'): fica fora do limite da semana.
-- Para bancos criados antes disso, troca o check antigo pelo novo.
alter table public.gastos drop constraint if exists gastos_fonte_check;
alter table public.gastos add constraint gastos_fonte_check check (fonte in ('conta','cartao','vr','mob','caixinha'));

create index if not exists gastos_user_data   on public.gastos   (user_id, data desc);
create index if not exists caixinha_user_data on public.caixinha (user_id, data desc);

-- -------------------------------------------------------------
-- Segurança: cada pessoa só enxerga e altera as PRÓPRIAS linhas
-- -------------------------------------------------------------
alter table public.perfis   enable row level security;
alter table public.gastos   enable row level security;
alter table public.caixinha enable row level security;

drop policy if exists "perfis_dono"   on public.perfis;
drop policy if exists "gastos_dono"   on public.gastos;
drop policy if exists "caixinha_dono" on public.caixinha;

create policy "perfis_dono" on public.perfis
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "gastos_dono" on public.gastos
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "caixinha_dono" on public.caixinha
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Quem não está logado (papel "anon") não acessa nada
revoke all on public.perfis, public.gastos, public.caixinha from anon;
grant select, insert, update, delete on public.perfis, public.gastos, public.caixinha to authenticated;

-- -------------------------------------------------------------
-- Chave dos atalhos do iPhone (Conferir caixinha, Lançar gasto)
-- Guarda só o hash SHA-256 da chave; a chave em si aparece uma vez no app e fica no atalho.
-- Quem usa a tabela com a chave é a função atalho (com a chave de serviço, no servidor).
-- -------------------------------------------------------------
create table if not exists public.atalhos (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  criado     timestamptz not null default now()
);
alter table public.atalhos enable row level security;
drop policy if exists "atalhos_dono" on public.atalhos;
create policy "atalhos_dono" on public.atalhos
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.atalhos from anon;
grant select, insert, update, delete on public.atalhos to authenticated;
-- A função atalho (papel service_role) usa estas tabelas nos atalhos; em projetos novos do Supabase
-- tabela nova não vem liberada para esse papel, então as permissões ficam explícitas (só o necessário).
grant select on public.atalhos to service_role;
grant select, insert on public.gastos, public.caixinha to service_role;
grant select, update on public.perfis to service_role;

-- -------------------------------------------------------------
-- Conversar com o Leve por mensagem: Telegram (em uso) e WhatsApp (pronto, ainda sem número)
-- telegram / whatsapp: ligam uma conversa a uma pessoa. O app cria um código de uso único (só o hash fica
--   aqui, com validade); a pessoa manda o código pelo Telegram ou WhatsApp e a função grava o chat_id ou o
--   telefone. O app NÃO consegue gravar essas colunas (permissão por coluna), então ninguém liga a conversa
--   de outra pessoa à própria conta. historico = últimas falas, para entender "apaga isso".
-- mensagens_vistas: ids das mensagens já tratadas (Telegram e WhatsApp repetem entregas). Só as funções usam.
-- -------------------------------------------------------------
create table if not exists public.telegram (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  codigo_hash   text check (codigo_hash ~ '^[0-9a-f]{64}$'),
  codigo_expira timestamptz,
  chat_id       bigint unique,
  ligado        timestamptz,
  historico     jsonb not null default '[]'::jsonb check (pg_column_size(historico) < 16384),
  criado        timestamptz not null default now()
);
create table if not exists public.whatsapp (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  codigo_hash   text check (codigo_hash ~ '^[0-9a-f]{64}$'),
  codigo_expira timestamptz,
  telefone      text unique check (telefone ~ '^[0-9]{8,20}$'),
  ligado        timestamptz,
  historico     jsonb not null default '[]'::jsonb check (pg_column_size(historico) < 16384),
  criado        timestamptz not null default now()
);
alter table public.telegram enable row level security;
alter table public.whatsapp enable row level security;
drop policy if exists "telegram_dono" on public.telegram;
create policy "telegram_dono" on public.telegram
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "whatsapp_dono" on public.whatsapp;
create policy "whatsapp_dono" on public.whatsapp
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.telegram, public.whatsapp from anon, authenticated;
grant select, delete on public.telegram, public.whatsapp to authenticated;
grant insert (user_id, codigo_hash, codigo_expira) on public.telegram, public.whatsapp to authenticated;
grant update (codigo_hash, codigo_expira) on public.telegram, public.whatsapp to authenticated;
grant select, update on public.telegram, public.whatsapp to service_role;

create table if not exists public.mensagens_vistas (
  id     text primary key check (char_length(id) between 1 and 220),
  criado timestamptz not null default now()
);
alter table public.mensagens_vistas enable row level security;  -- sem policy: só a chave de serviço acessa
revoke all on public.mensagens_vistas from anon, authenticated;
grant select, insert, delete on public.mensagens_vistas to service_role;
drop table if exists public.whatsapp_vistas;  -- nome antigo (só guardava ids de mensagens já tratadas)
-- Pela conversa dá para corrigir e apagar gastos lançados por ela (ids "tg-…" e "wa-…")
grant update, delete on public.gastos to service_role;

-- -------------------------------------------------------------
-- Avisos do bot do Telegram (resumo da noite, semana nova, dia do salário, alerta de limite)
-- telegram.avisos: o que cada pessoa desligou ({"noite": false, …}); muda pelo /avisos do bot, não pelo app.
-- avisos_enviados: cada aviso sai uma vez só (chave "noite:2026-11-13", "a80:2026-11-09"…). Só a função usa.
-- O banco chama a função telegram de hora em hora (pg_cron + pg_net); ela manda o que estiver na hora.
-- -------------------------------------------------------------
alter table public.telegram add column if not exists avisos jsonb not null default '{}'::jsonb;
alter table public.telegram drop constraint if exists telegram_avisos_objeto;
alter table public.telegram add constraint telegram_avisos_objeto check (jsonb_typeof(avisos) = 'object' and pg_column_size(avisos) < 2048);

create table if not exists public.avisos_enviados (
  user_id uuid not null references auth.users(id) on delete cascade,
  chave   text not null check (char_length(chave) between 1 and 60),
  criado  timestamptz not null default now(),
  primary key (user_id, chave)
);
alter table public.avisos_enviados enable row level security;  -- sem policy: só a chave de serviço acessa
revoke all on public.avisos_enviados from anon, authenticated;
grant select, insert, delete on public.avisos_enviados to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- (rodar de novo só atualiza o mesmo agendamento)
select cron.schedule('leve-avisos', '0 * * * *', $cron$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/telegram',
    body := '{"acao":"avisos"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);

-- -------------------------------------------------------------
-- Conferência (opcional): deve listar as 3 tabelas com rowsecurity = true
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public' and tablename in ('perfis','gastos','caixinha');
-- -------------------------------------------------------------
