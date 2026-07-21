import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL ou chave não definida no .env')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const wipe = async (table) => {
    const { error } = await supabase.from(table).delete().neq('id', '')
    if (error) throw new Error(`Falha ao limpar ${table}: ${error.message}`)
  }
  try {
    await wipe('produto_saidas')
    await wipe('produtos')
    await wipe('chamados')
    await wipe('equipamentos')
    await wipe('app_users')
    await wipe('setores')

    const setores = [
      { nome: 'TI', responsavel: null, ramal: null, localizacao: 'SÃO PAULO/SP' },
      { nome: 'ADMINISTRATIVO', responsavel: null, ramal: null, localizacao: 'SÃO PAULO/SP' },
    ]
    const { error: setErr } = await supabase.from('setores').insert(setores)
    if (setErr) throw new Error(`Falha ao inserir setores: ${setErr.message}`)

    const equipamentos = [
      { nome: 'Desktop de Teste', tipo: 'Desktop', patrimonio: 'PC001', status: 'Disponível', usuario: 'JOÃO TESTE', setor: 'TI' },
      { nome: 'Notebook de Teste', tipo: 'Notebook', patrimonio: 'PC002', status: 'Em Uso', usuario: 'MARIA DEMO', setor: 'ADMINISTRATIVO', ram: '16GB', armazenamento: '512GB SSD', processador: 'Intel i7' },
      { nome: 'Tablet de Teste', tipo: 'Tablet', patrimonio: 'TAB-001', status: 'Manutenção', usuario: '-', setor: 'TI' },
    ]
    const { error: eqErr } = await supabase.from('equipamentos').insert(equipamentos)
    if (eqErr) throw new Error(`Falha ao inserir equipamentos: ${eqErr.message}`)

    const usuarios = [
      { username: 'admin', name: 'ADMIN KMZ', setor: 'TI', cargo: 'ADMIN', tier: 'admin', password_hash: 'admin' },
      { username: 'joao', name: 'JOÃO TESTE', setor: 'ADMINISTRATIVO', cargo: 'USUÁRIO', tier: 'padrao', password_hash: '123456' },
    ]
    const { error: usrErr } = await supabase.from('app_users').insert(usuarios)
    if (usrErr) throw new Error(`Falha ao inserir usuários: ${usrErr.message}`)

    const chamados = [
      { titulo: 'Instalação de Software', descricao: 'Instalar antivírus no PC001', prioridade: 'media', status: 'Aberto', usuario: 'JOÃO TESTE', solicitante: 'TI', setor: 'TI', tipo_servico: 'Software', data: new Date().toISOString() },
      { titulo: 'Troca de Tela', descricao: 'Notebook PC002 com tela trincada', prioridade: 'alta', status: 'Em Andamento', usuario: 'MARIA DEMO', solicitante: 'ADMINISTRATIVO', setor: 'ADMINISTRATIVO', tipo_servico: 'Hardware', data: new Date().toISOString(), is_vip: true },
      { titulo: 'Configurar Email', descricao: 'Configurar email corporativo no TAB-001', prioridade: 'baixa', status: 'Concluído', usuario: 'JOÃO TESTE', solicitante: 'TI', setor: 'TI', tipo_servico: 'Suporte', data: new Date().toISOString() },
    ]
    const { error: chErr } = await supabase.from('chamados').insert(chamados)
    if (chErr) throw new Error(`Falha ao inserir chamados: ${chErr.message}`)

    const produtos = [
      { nome: 'Mouse KMZ', categoria: 'Periféricos', descricao: 'Mouse óptico KMZ', estoque: 20 },
      { nome: 'Teclado KMZ', categoria: 'Periféricos', descricao: 'Teclado mecânico KMZ', estoque: 10 },
    ]
    const { error: pdErr } = await supabase.from('produtos').insert(produtos)
    if (pdErr) throw new Error(`Falha ao inserir produtos: ${pdErr.message}`)

    console.log('Base limpa e dados de teste KMZ inseridos com sucesso.')
    process.exit(0)
  } catch (e) {
    console.error(e.message || String(e))
    process.exit(1)
  }
}

main()
