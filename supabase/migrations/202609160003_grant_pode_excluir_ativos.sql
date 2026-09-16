begin;

-- Correção de 202609160001: a coluna pode_excluir_ativos foi criada sem entrar
-- no grant por coluna de app_users.
--
-- `authenticated` só enxerga as colunas listadas em
-- 202607200001_secure_auth_migration.sql (linha 144). Pedir uma coluna fora
-- dessa lista devolve 403, e como loadProfile desloga quando o perfil não
-- carrega, o efeito era impedir qualquer login.
grant select (pode_excluir_ativos) on public.app_users to authenticated;

commit;
