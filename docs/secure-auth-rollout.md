# Migração gradual para Supabase Auth

## Estado auditado

- `app_users.password_hash` é comparado como texto puro pelo cliente atual.
- A sessão atual é um objeto manual em `localStorage` e não serve como autorização server-side.
- O projeto ainda não possui vínculo entre `app_users` e `auth.users`.
- Contagens anteriores: 85 usuários, 108 equipamentos e 244 chamados.

## Objetos preparados, ainda não aplicados

- Coluna opcional `public.app_users.auth_user_id` com referência a `auth.users(id)`.
- Índice único parcial `app_users_auth_user_id_unique`.
- Tabela privada `public.auth_login_rate_limits`, com RLS e grants revogados.
- Função atômica `public.consume_auth_login_rate_limit` restrita a `service_role`.
- Políticas de `app_users` para leitura própria/administrativa e escrita administrativa.
- Edge Function `auth-migrate-login`.

## Pré-requisitos para aplicar e testar o primeiro administrador

1. Confirmar backup recente e o project ref correto do Supabase.
2. Revisar `202607200001_secure_auth_migration.sql` no ambiente alvo.
3. Configurar `ALLOWED_APP_ORIGINS` e `AUTH_RATE_LIMIT_SALT` como secrets da Edge Function.
4. Confirmar que os secrets padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão disponíveis na Edge Function.
5. Aplicar somente esta migration e publicar somente `auth-migrate-login`.
6. Testar um administrador pelo formulário normal, sem registrar sua senha.
7. Confirmar JWT, vínculo, perfil, logout, RLS e contagens antes de conectar o frontend permanentemente.

Não aplicar migrations pendentes em lote, não executar reset/seed e não remover o login legado antes da aprovação do teste administrativo.
