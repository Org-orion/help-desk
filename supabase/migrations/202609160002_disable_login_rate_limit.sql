begin;

-- Limite de tentativas de login desativado a pedido da operação.
--
-- O comportamento anterior consumia o contador em TODA tentativa, antes de
-- conferir a senha, e nada o zerava num login bem-sucedido: cinco entradas
-- corretas em quinze minutos já bloqueavam o usuário por mais quinze.
--
-- A assinatura e o retorno são preservados para que a edge function
-- auth-migrate-login continue funcionando sem redeploy — ela passa a receber
-- sempre uma autorização.
--
-- ATENÇÃO: sem este limite o login não tem nenhuma proteção contra força
-- bruta, e app_users.password_hash guarda as senhas legadas em texto puro.
-- Para religar, basta reaplicar a versão original em
-- supabase/migrations/202607200001_secure_auth_migration.sql.
create or replace function public.consume_auth_login_rate_limit(
  p_key_hash char(64), p_max_attempts integer default 5,
  p_window_seconds integer default 900, p_block_seconds integer default 900
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
begin
  allowed := true;
  retry_after_seconds := 0;
  return next;
end $$;

-- Remove os bloqueios que já estavam ativos.
delete from public.auth_login_rate_limits;

commit;
