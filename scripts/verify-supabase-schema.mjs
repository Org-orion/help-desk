import 'dotenv/config'
import { Client } from 'pg'

const REQUIRED_TABLES = [
  'app_users',
  'setores',
  'equipamentos',
  'produtos',
  'produto_saidas',
  'chamados',
]

const REQUIRED_CONSTRAINTS = [
  'produtos_estoque_nonneg',
  'produto_saidas_quantidade_pos',
]

const REQUIRED_TRIGGERS = [
  'trg_produto_saidas_after_insert',
  'trg_chamados_before_insert',
]

const REQUIRED_INDEXES = [
  'idx_app_users_tier',
  'idx_equipamentos_status',
  'idx_produtos_categoria',
  'idx_produto_saidas_produto_data',
  'idx_chamados_status',
  'idx_chamados_prioridade',
  'idx_chamados_data',
]

async function main() {
  const direct = process.env.SUPABASE_DB_URL
  let url = direct
  if (!url) {
    const viteUrl = process.env.VITE_SUPABASE_URL
    const dbPass = process.env.SUPABASE_DB_PASSWORD
    if (viteUrl && dbPass) {
      const m = viteUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i)
      const ref = m ? m[1] : null
      if (ref) {
        url = `postgresql://postgres:${encodeURIComponent(dbPass)}@db.${ref}.supabase.co:5432/postgres`
      }
    }
  }
  if (!url) {
    console.error('SUPABASE_DB_URL não definido no .env. Defina SUPABASE_DB_URL ou SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL.')
    process.exit(1)
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const results = {}

  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public'`
  )
  const tableSet = new Set(tables.map(t => t.table_name))
  results.tables = REQUIRED_TABLES.map(name => ({ name, exists: tableSet.has(name) }))

  const { rows: constraints } = await client.query(
    `select conname from pg_constraint`
  )
  const constraintSet = new Set(constraints.map(c => c.conname))
  results.constraints = REQUIRED_CONSTRAINTS.map(name => ({ name, exists: constraintSet.has(name) }))

  const { rows: triggers } = await client.query(
    `select tgname from pg_trigger where not tgisinternal`
  )
  const triggerSet = new Set(triggers.map(t => t.tgname))
  results.triggers = REQUIRED_TRIGGERS.map(name => ({ name, exists: triggerSet.has(name) }))

  const { rows: indexes } = await client.query(
    `select indexname from pg_indexes where schemaname='public'`
  )
  const indexSet = new Set(indexes.map(i => i.indexname))
  results.indexes = REQUIRED_INDEXES.map(name => ({ name, exists: indexSet.has(name) }))

  await client.end()

  const summary = {
    missingTables: results.tables.filter(x => !x.exists).map(x => x.name),
    missingConstraints: results.constraints.filter(x => !x.exists).map(x => x.name),
    missingTriggers: results.triggers.filter(x => !x.exists).map(x => x.name),
    missingIndexes: results.indexes.filter(x => !x.exists).map(x => x.name),
  }

  const ok = Object.values(summary).every(arr => arr.length === 0)
  if (ok) {
    console.log('Schema conferido: todas as tabelas, constraints, triggers e índices presentes.')
  } else {
    console.log('Verificação do schema com pendências:')
    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = 2
  }
}

main().catch(err => {
  console.error('Erro ao verificar schema:', err?.message || err)
  process.exit(1)
})
