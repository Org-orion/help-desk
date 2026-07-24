import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getEquipamentoPrincipal,
  listEquipamentosPrincipaisDisponiveis,
  listEquipamentosVinculados,
  validateEquipamentoVinculoLocal,
} from '../src/lib/equipment-links.ts'

const pc = { id: 'pc', nome: 'PC001', tipo: 'Desktop', patrimonio: 'PC001', status: 'Em Uso', equipamento_pai_id: null }
const monitor = { id: 'monitor', nome: 'Monitor', tipo: 'Monitor', patrimonio: 'MON001', status: 'Em Uso', equipamento_pai_id: 'pc' }
const teclado = { id: 'teclado', nome: 'Teclado', tipo: 'Periférico', patrimonio: 'TEC001', status: 'Em Uso', equipamento_pai_id: 'pc' }
const notebook = { id: 'notebook', nome: 'Notebook', tipo: 'Notebook', patrimonio: 'PC002', status: 'Disponível', equipamento_pai_id: null }
const equipamentos = [pc, monitor, teclado, notebook]

test('localiza o equipamento principal e seus vinculados sem criar árvore recursiva', () => {
  assert.equal(getEquipamentoPrincipal(monitor, equipamentos)?.id, 'pc')
  assert.deepEqual(listEquipamentosVinculados('pc', equipamentos).map((item) => item.id), ['monitor', 'teclado'])
  assert.equal(getEquipamentoPrincipal(pc, equipamentos), null)
})

test('lista somente equipamentos independentes que podem atuar como principais', () => {
  assert.deepEqual(
    listEquipamentosPrincipaisDisponiveis(equipamentos).map((item) => item.id),
    ['pc', 'notebook'],
  )
  assert.deepEqual(
    listEquipamentosPrincipaisDisponiveis(equipamentos, 'monitor').map((item) => item.id),
    ['pc', 'notebook'],
  )
  assert.deepEqual(listEquipamentosPrincipaisDisponiveis(equipamentos, 'pc'), [])
})

test('permite criar e manter equipamento sem vínculo', () => {
  assert.equal(validateEquipamentoVinculoLocal(undefined, null, equipamentos), null)
  assert.equal(validateEquipamentoVinculoLocal('monitor', null, equipamentos), null)
})

test('permite vincular e trocar para outro equipamento principal independente', () => {
  assert.equal(validateEquipamentoVinculoLocal(undefined, 'pc', equipamentos), null)
  assert.equal(validateEquipamentoVinculoLocal('monitor', 'notebook', equipamentos), null)
})

test('impede autorreferência, segundo nível e transformação de principal com filhos em vinculado', () => {
  assert.match(validateEquipamentoVinculoLocal('pc', 'pc', equipamentos) ?? '', /ele mesmo/)
  assert.match(validateEquipamentoVinculoLocal('notebook', 'monitor', equipamentos) ?? '', /vinculado/)
  assert.match(validateEquipamentoVinculoLocal('pc', 'notebook', equipamentos) ?? '', /possui vinculados/)
})

test('remoção do principal deixa o vínculo resolvido como ausente sem remover o equipamento', () => {
  const afterParentDelete = equipamentos.filter((item) => item.id !== 'pc').map((item) =>
    item.equipamento_pai_id === 'pc' ? { ...item, equipamento_pai_id: null } : item
  )
  assert.equal(afterParentDelete.some((item) => item.id === 'monitor'), true)
  assert.equal(getEquipamentoPrincipal(afterParentDelete[0], afterParentDelete), null)
})

test('migração usa UUID, FK autorreferencial, ON DELETE SET NULL, índice e trigger de nível único', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/202607240001_add_equipment_parent_link.sql', import.meta.url),
    'utf8',
  )
  assert.match(sql, /add column if not exists equipamento_pai_id uuid null/i)
  assert.match(sql, /foreign key \(equipamento_pai_id\)\s+references public\.equipamentos\(id\)\s+on delete set null/is)
  assert.match(sql, /create index if not exists idx_equipamentos_equipamento_pai_id/i)
  assert.match(sql, /EQUIPMENT_LINK_SELF/)
  assert.match(sql, /EQUIPMENT_LINK_PARENT_IS_LINKED/)
  assert.match(sql, /EQUIPMENT_LINK_CHILD_HAS_LINKS/)
  assert.match(sql, /language plpgsql\s+security definer\s+set search_path = ''/is)
  assert.match(sql, /before insert or update of equipamento_pai_id/i)
})
