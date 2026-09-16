import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { equipamentoError } from '../src/lib/equipment-errors.ts'

const migration = readFileSync(
  new URL('../supabase/migrations/202609160001_add_equipment_delete_permission.sql', import.meta.url),
  'utf8',
)

test('explica a recusa por permissão em vez do erro cru', () => {
  assert.match(
    equipamentoError({ code: '42501', message: 'EQUIPMENT_DELETE_FORBIDDEN' }).message,
    /não tem permissão para excluir ativos/,
  )
})

test('tira o delete direto do alcance da chave anônima', () => {
  assert.match(migration, /revoke delete on public\.equipamentos from anon, authenticated/)
})

test('a permissão é conferida no servidor, não só na tela', () => {
  const fn = migration.slice(migration.indexOf('create or replace function public.excluir_equipamento'))
  assert.match(fn, /from public\.app_users[\s\S]*pode_excluir_ativos/)
  assert.match(fn, /EQUIPMENT_DELETE_FORBIDDEN/)
  // a checagem precisa vir antes de qualquer escrita
  assert.ok(fn.indexOf('EQUIPMENT_DELETE_FORBIDDEN') < fn.indexOf('delete from public.equipamentos'))
})

test('a permissão nasce desligada para todo mundo', () => {
  assert.match(migration, /pode_excluir_ativos boolean not null default false/)
})

test('solta as etiquetas QR para que qualquer ativo possa ser excluído', () => {
  // status BOUND exige equipment_id não nulo: a etiqueta precisa virar VOID no mesmo update
  assert.match(migration, /set status = 'VOID', equipment_id = null/)
  assert.match(migration, /update public\.equipment_qr_label_audit[\s\S]*set equipment_id = null/)
})

test('preserva a trilha da etiqueta registrando a invalidação', () => {
  assert.match(migration, /insert into public\.equipment_qr_label_audit[\s\S]*'VOIDED'/)
})

test('o botão Excluir some para quem não tem permissão', () => {
  const source = readFileSync(new URL('../src/pages/Equipamentos.tsx', import.meta.url), 'utf8')
  assert.match(source, /podeExcluirAtivos = user\?\.podeExcluirAtivos === true/)
  assert.match(source, /onDelete=\{podeExcluirAtivos \?/)
  assert.match(source, /\{onDelete && \(/)
})
