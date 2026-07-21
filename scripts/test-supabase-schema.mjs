import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL ou chave não definida no .env')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const testTag = `t${Date.now()}`

  const { data: prod, error: prodErr } = await supabase
    .from('produtos')
    .insert({ nome: `Produto ${testTag}`, categoria: 'Teste', descricao: 'Schema test', estoque: 10 })
    .select('*')
    .single()
  if (prodErr) {
    console.error('Falha ao criar produto:', prodErr.message)
    process.exit(1)
  }

  const { error: saidaErr } = await supabase
    .from('produto_saidas')
    .insert({ produto_id: prod.id, quantidade: 3, destinatario: 'QA', data: new Date().toISOString() })
  if (saidaErr) {
    console.error('Falha ao registrar saída de produto:', saidaErr.message)
    process.exit(1)
  }

  const { data: prodAfter, error: prodAfterErr } = await supabase
    .from('produtos')
    .select('estoque')
    .eq('id', prod.id)
    .single()
  if (prodAfterErr) {
    console.error('Falha ao ler produto após saída:', prodAfterErr.message)
    process.exit(1)
  }

  const estoqueOk = prodAfter?.estoque === 7

  const chamadoPayload = {
    titulo: `Chamado VIP ${testTag}`,
    descricao: 'Teste de prioridade VIP',
    prioridade: 'baixa',
    status: 'Aberto',
    usuario: 'tester',
    solicitante: 'qa',
    setor: 'TI',
    tipo_servico: 'Verificação',
    is_vip: true,
    data: new Date().toISOString(),
  }
  const { data: chamado, error: chamadoErr } = await supabase
    .from('chamados')
    .insert(chamadoPayload)
    .select('*')
    .single()
  if (chamadoErr) {
    console.error('Falha ao criar chamado:', chamadoErr.message)
    process.exit(1)
  }

  const prioridadeOk = chamado?.prioridade === 'alta'

  const summary = { estoqueOk, prioridadeOk }
  console.log(JSON.stringify(summary))

  const allOk = Object.values(summary).every(Boolean)
  process.exitCode = allOk ? 0 : 2
}

main().catch(err => {
  console.error('Erro no teste de schema:', err?.message || err)
  process.exit(1)
})

