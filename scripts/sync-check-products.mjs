import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const api = process.env.VITE_API_URL || 'http://localhost:3002/bot'

async function main() {
  if (!url || !key) {
    console.error('Env SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausente')
    process.exit(1)
  }
  const sb = createClient(url, key)
  const { data: spRows, error: spErr } = await sb.from('produtos').select('id').order('created_at', { ascending: false })
  if (spErr) {
    console.error('Supabase erro:', spErr.message)
    process.exit(1)
  }
  let restRows = []
  try {
    const r = await fetch(`${api}/produtos`)
    if (r.ok) restRows = await r.json()
    else console.error('REST erro status:', r.status)
  } catch (e) {
    console.error('REST erro:', e?.message || e)
  }
  console.log(JSON.stringify({ supabase_count: spRows?.length ?? 0, rest_count: restRows?.length ?? 0 }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })

