import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_TABLES = [
  'app_users',
  'setores',
  'equipamentos',
  'produtos',
  'produto_saidas',
  'chamados',
]

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL ou chave não definida no .env')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const results = []
  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select('id').limit(1)
    results.push({ table, ok: !error, error: error?.message })
  }

  const missing = results.filter(r => !r.ok)
  if (missing.length === 0) {
    console.log('Todas as tabelas públicas estão acessíveis via API.')
  } else {
    console.log('Tabelas com problemas:')
    console.log(JSON.stringify(missing, null, 2))
    process.exitCode = 2
  }
}

main().catch(err => {
  console.error('Erro ao verificar tabelas via API:', err?.message || err)
  process.exit(1)
})

