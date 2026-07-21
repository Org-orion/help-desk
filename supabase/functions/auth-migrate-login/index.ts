import { createClient } from 'npm:@supabase/supabase-js@2'

const INVALID_LOGIN = 'Usuário ou senha inválidos.'
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

type LoginBody = { username: string; password: string; newPassword?: string }

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  const configured = (Deno.env.get('ALLOWED_APP_ORIGINS') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  return origin && configured.includes(origin) ? origin : null
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function technicalEmail(userId: string): string {
  return `${userId}@internal.invalid`
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request)
  if (request.headers.get('origin') && !origin) return json(403, { error: INVALID_LOGIN }, null)
  if (request.method === 'OPTIONS') {
    if (!origin) return json(403, { error: INVALID_LOGIN }, null)
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    } })
  }
  if (request.method !== 'POST') return json(405, { error: INVALID_LOGIN }, origin)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 4096) return json(400, { error: INVALID_LOGIN }, origin)

  let body: LoginBody
  try { body = await request.json() as LoginBody } catch { return json(400, { error: INVALID_LOGIN }, origin) }
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') return json(400, { error: INVALID_LOGIN }, origin)
  const username = body.username.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username) || body.password.length < 1 || body.password.length > 256) return json(401, { error: INVALID_LOGIN }, origin)
  if (body.newPassword !== undefined && (typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 256)) {
    return json(400, { error: 'A nova senha deve possuir no mínimo 8 caracteres.' }, origin)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const rateLimitSalt = Deno.env.get('AUTH_RATE_LIMIT_SALT')
  if (!url || !anonKey || !serviceKey || !rateLimitSalt) return json(503, { error: 'Serviço temporariamente indisponível.' }, origin)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || 'unknown'
  const keys = await Promise.all([sha256(`${rateLimitSalt}:ip:${clientIp}`), sha256(`${rateLimitSalt}:username:${username}`)])
  for (const key of keys) {
    const { data, error } = await admin.rpc('consume_auth_login_rate_limit', { p_key_hash: key })
    if (error) return json(503, { error: 'Serviço temporariamente indisponível.' }, origin)
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.allowed) {
      const response = json(429, { error: INVALID_LOGIN }, origin)
      response.headers.set('Retry-After', String(result?.retry_after_seconds ?? 900))
      return response
    }
  }

  const { data: profile, error: profileError } = await admin
    .from('app_users')
    .select('id, username, name, tier, auth_user_id, password_hash')
    .ilike('username', username)
    .maybeSingle()
  if (profileError || !profile) return json(401, { error: INVALID_LOGIN }, origin)

  const email = technicalEmail(profile.id)
  if (profile.auth_user_id) {
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await auth.auth.signInWithPassword({ email, password: body.password })
    if (error || !data.session) return json(401, { error: INVALID_LOGIN }, origin)
    return json(200, { session: data.session }, origin)
  }

  // The current application stores legacy credentials as plaintext. Compare only in server memory.
  if (profile.password_hash !== body.password) return json(401, { error: INVALID_LOGIN }, origin)
  if (body.password.length < 8 && !body.newPassword) {
    return json(409, { error: 'PASSWORD_UPGRADE_REQUIRED', passwordUpgradeRequired: true }, origin)
  }

  const authPassword = body.newPassword ?? body.password

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: authPassword,
    email_confirm: true,
  })
  if (createError || !created.user) return json(401, { error: INVALID_LOGIN }, origin)

  const { data: linked, error: linkError } = await admin
    .from('app_users')
    .update({ auth_user_id: created.user.id, password_hash: `MIGRATED:${await sha256(crypto.randomUUID())}` })
    .eq('id', profile.id)
    .is('auth_user_id', null)
    .select('id')
    .maybeSingle()
  if (linkError || !linked) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json(503, { error: 'Serviço temporariamente indisponível.' }, origin)
  }

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await auth.auth.signInWithPassword({ email, password: authPassword })
  if (error || !data.session) return json(503, { error: 'Serviço temporariamente indisponível.' }, origin)
  return json(200, { session: data.session }, origin)
})
