import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

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
    console.error('SUPABASE_DB_URL não definido. Defina SUPABASE_DB_URL ou SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL no .env.')
    process.exit(1)
  }
  const sqlPath = new URL('../supabase/schema.sql', import.meta.url)
  const sql = await readFile(sqlPath, 'utf8')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(sql)
    console.log('Schema aplicado com sucesso.')
  } catch (err) {
    console.error('Erro ao aplicar schema:', err?.message || err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
