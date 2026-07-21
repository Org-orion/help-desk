const apiUrl = process.env.API_URL || 'http://localhost:3001'

async function clearUsuariosCargo() {
  const r = await fetch(`${apiUrl}/usuarios`)
  if (!r.ok) throw new Error('Falha ao listar usuários')
  const usuarios = await r.json()
  let changed = 0
  for (const u of usuarios) {
    if (u.cargo != null && u.cargo !== '') {
      const pr = await fetch(`${apiUrl}/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargo: null }),
      })
      if (pr.ok) changed++
    }
  }
  return changed
}

async function clearSetoresFields() {
  const r = await fetch(`${apiUrl}/setores`)
  if (!r.ok) throw new Error('Falha ao listar setores')
  const setores = await r.json()
  let changed = 0
  for (const s of setores) {
    const needs = (s.ramal != null && s.ramal !== '') || (s.responsavel != null && s.responsavel !== '')
    if (needs) {
      const pr = await fetch(`${apiUrl}/setores/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ramal: null, responsavel: null }),
      })
      if (pr.ok) changed++
    }
  }
  return changed
}

async function main() {
  try {
    const u = await clearUsuariosCargo()
    const s = await clearSetoresFields()
    console.log(JSON.stringify({ usuarios_cargo_cleared: u, setores_fields_cleared: s }))
    process.exit(0)
  } catch (e) {
    console.error(e.message || String(e))
    process.exit(1)
  }
}

main()

