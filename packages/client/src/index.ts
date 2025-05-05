import { apiClient, type Config, type Token } from './apiClient'
import { mono } from '@mono/env'
import { logger, type Logger } from './logger'

type Context = Partial<{
  users: User[]
}>

type User = {
  id: number
  name: string
}

const App = <L extends Logger>(config: Config<Context, L>) =>
  apiClient<Context, L>(config)

export const api = (app: ReturnType<typeof App>) => ({
  // internals
  getContext: () => app(async ({ context }) => context),
  getHttpClient: () => app(async ({ httpClient }) => httpClient),

  // http
  getUserById: (id: string | number) =>
    app(async ({ httpClient, context, logger }) => {
      const usr = await httpClient.get<User>('/api/user', { params: { id } })
      context.users = (context.users ?? []).concat(usr.data)
      return usr.data
    }),
})

export default App

const app = App({
  account: mono.account,
  baseURL: mono.baseURL,
  context: {},
  logger,
  delay: {
    base: 100,
    type: 'exponential',
  },
  retries: 10,
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  const client = api(app)
  await client.getUserById('123')
  await client.getUserById('456')

  const state = await client.getContext()
  console.log(state)

  await delay(2_000)

  await client.getUserById('789')

  console.log(state)
}

main()
