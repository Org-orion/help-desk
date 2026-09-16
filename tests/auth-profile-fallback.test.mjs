import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/contexts/AuthContext.tsx', import.meta.url), 'utf8')
const loadProfile = source.slice(source.indexOf('async function loadProfile'), source.indexOf('export function AuthProvider'))
const migration = readFileSync(
  new URL('../supabase/migrations/202609160001_add_equipment_delete_permission.sql', import.meta.url),
  'utf8',
)

test('app_users tem grant por coluna: toda coluna nova precisa do grant', () => {
  assert.match(migration, /grant select \(pode_excluir_ativos\) on public\.app_users to authenticated/)
})

test('coluna indisponível não derruba o login', () => {
  // 42703 = coluna inexistente; 42501 = existe mas sem privilégio de leitura
  assert.match(source, /MISSING_OPTIONAL_COLUMN_CODES=new Set\(\['42703','42501'\]\)/)
  assert.match(loadProfile, /select\(PROFILE_CORE_COLUMNS\)/)
})

test('qualquer outro erro continua invalidando o perfil', () => {
  assert.match(loadProfile, /if\(!error\|\|!MISSING_OPTIONAL_COLUMN_CODES\.has\(error\.code\)\)return null/)
})

test('sem a coluna, a permissão de excluir fica desligada', () => {
  assert.match(source, /podeExcluirAtivos:row\.pode_excluir_ativos===true/)
})
