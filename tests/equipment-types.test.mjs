import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const equipamentos = read('../src/pages/Equipamentos.tsx')
const config = read('../src/lib/config/equipment.ts')
const produtos = read('../src/pages/Produtos.tsx')

/** Opções do Select "Tipo" no formulário de cadastro de ativo. */
const tiposDoFormulario = () => {
  const inicio = equipamentos.indexOf('<Label htmlFor="tipo">Tipo</Label>')
  const bloco = equipamentos.slice(inicio, equipamentos.indexOf('</Select>', inicio))
  return [...bloco.matchAll(/<SelectItem value="([^"]+)">/g)].map((m) => m[1])
}

/** Chaves do mapa de ícones por tipo, em src/lib/config/equipment.ts. */
const tiposComIcone = () => {
  const bloco = config.slice(config.indexOf('equipmentTypeIconMap'), config.indexOf('export const getEquipmentTypeIcon'))
  return [...bloco.matchAll(/'([^']+)':\s*\w+,/g)].map((m) => m[1])
}

test('Periféricos é um tipo oferecido no cadastro', () => {
  assert.ok(tiposDoFormulario().includes('Periféricos'))
})

test('todo tipo oferecido tem ícone próprio, sem cair no genérico', () => {
  const comIcone = tiposComIcone()
  for (const tipo of tiposDoFormulario()) {
    assert.ok(comIcone.includes(tipo), `tipo "${tipo}" sem ícone em equipmentTypeIconMap`)
  }
})

test('a tela usa o mapa compartilhado, sem manter uma segunda cópia', () => {
  assert.match(equipamentos, /const getTypeIcon = getEquipmentTypeIcon;/)
  assert.doesNotMatch(equipamentos, /'Notebook': Laptop, 'Desktop': Cpu/)
})

test('Periféricos recebe prefixo de patrimônio e o código é reconhecido de volta', () => {
  assert.match(equipamentos, /if \(tipo === 'Periféricos'\) return 'PER';/)
  const regex = equipamentos.match(/match\(\/\^\(([^)]+)\)-\?/)[1].split('|')
  assert.ok(regex.includes('PER'), 'PER fora da regex que lê o patrimônio')
})

test('o filtro por tipo conhece PER', () => {
  assert.match(equipamentos, /'all' \| 'PC' \| 'TAB' \| 'CEL' \| 'IMP' \| 'MON' \| 'PER'/)
  assert.match(equipamentos, /active=\{activeType === 'PER'\}/)
})

test('usa o mesmo rótulo que o estoque já usa, no plural', () => {
  assert.ok(produtos.includes('<SelectItem value="Periféricos">'))
  assert.ok(!equipamentos.includes('value="Periférico"'), 'singular divergiria do vocabulário do estoque')
})
