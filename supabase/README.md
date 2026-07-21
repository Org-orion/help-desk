# Supabase Setup

## Variáveis de ambiente

Crie `.env` na raiz com:

```
VITE_SUPABASE_URL=xxxxxxxx
VITE_SUPABASE_ANON_KEY=xxxxxxxx
```

## Criar tabelas

Abra o SQL editor do seu projeto no Supabase e execute o conteúdo de `supabase/schema.sql`.

Isso cria:
- `app_users` (usuários com `tier`: padrao|vip|admin)
- `setores`
- `equipamentos`
- `produtos`
- `produto_saidas` (histórico de saídas)
- `chamados`

Por padrão o RLS está desativado para desenvolvimento. Em produção, habilite RLS e crie policies conforme necessidade.

## Cliente

O cliente está em `src/lib/supabase.ts` usando `import.meta.env`.

## Atualizar cache da API

Após criar/alterar tabelas, vá em Settings → API e clique em “Reset API cache” para o PostgREST reconhecer o novo schema.

## Verificar conexão

1. Preencha `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (API → Project API keys).
2. Reinicie `npm run dev`.
3. A aplicação mostra um toast com o status da conexão.
4. Opcional: rode `npm run db:verify:http` para checar se as tabelas estão visíveis pela API.
