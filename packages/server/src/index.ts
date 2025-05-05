import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { randomBytes } from 'node:crypto'
import { mono } from '@mono/env'

const app = new Hono()

// In-memory token store with expiration
const tokenStore: Record<string, { token: string; expiresAt: number }> = {}

// Function to generate a new token
function generateToken(): string {
  return randomBytes(16).toString('hex') // 32-character random token
}

// Logging middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  const clientIP =
    c.req.header('x-forwarded-for') || c.req.header('remote-addr') || 'unknown'
  const userAgent = c.req.header('user-agent') || 'unknown'
  const referer = c.req.header('referer') || '-'
  const user = c.req.header('x-user') || 'anonymous' // Assuming a custom header for user identification
  const timestamp = new Date().toISOString()

  // console.log(`[Request] ${c.req.method} ${c.req.url}`)
  await next()
  const duration = (Date.now() - start) / 1000 // Convert to seconds
  const responseSize = c.res.headers.get('content-length') || 0

  // const logJson = {
  //   agent: userAgent,
  //   client: clientIP,
  //   compression: duration.toFixed(2),
  //   referer,
  //   request: `${c.req.method} ${c.req.url} HTTP/${c.req.header('version') || '1.1'}`,
  //   size: Number(responseSize),
  //   status: c.res.status,
  //   timestamp,
  //   user,
  // }

  // console.log(JSON.stringify(logJson, null, 2))

  // const logString = `${clientIP} - ${user} [${new Date(timestamp).toUTCString()}] "${c.req.method} ${c.req.url} HTTP/${c.req.header('version') || '1.1'}" ${c.res.status} ${responseSize} "${referer}" "${userAgent}" "${duration.toFixed(2)}"`
  const logString = `${c.res.status} ${c.req.method} ${c.req.path} HTTP/${c.req.header('version') || '1.1'} ${userAgent} [${new Date(timestamp).toUTCString()}]`

  console.log(logString)
})

// Token endpoint
app.get('/token', c => {
  const account = c.req.query('account')
  const refreshToken = c.req.query('refreshToken')

  if (!account) {
    return c.json({ error: 'No account' }, 400)
  }

  const newToken = generateToken()
  tokenStore[account] = {
    token: newToken,
    expiresAt: Date.now() + mono.tokenExpiration * 60 * 1000,
  }

  if (refreshToken) {
    const storedToken = tokenStore[account]

    console.log({ storedToken, refreshToken })

    if (
      !storedToken ||
      storedToken.token !== refreshToken ||
      storedToken.expiresAt <= Date.now()
    ) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401)
    }

    const newToken = generateToken()
    tokenStore[account] = {
      token: newToken,
      expiresAt: Date.now() + mono.tokenExpiration * 60 * 1000,
    }
  }

  return c.json({ token: newToken })
})

// Middleware for Bearer token authentication
app.use(
  '/api/*',
  bearerAuth({
    verifyToken: token => {
      return Object.values(tokenStore).some(entry => entry.token === token)
    },
  }),
)

// Protected endpoint
app.get('/api/user', c => {
  const id = c.req.query('id')
  console.log(Object.values(tokenStore).map(entry => entry.token))

  const getUser = (id = '') => {
    const u: Record<string, string> = {
      '123': 'Sandra',
      '456': 'Martin',
      '789': 'Aman',
    }

    return u[id]
  }

  return c.json({ name: getUser(id), id })
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  info => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
