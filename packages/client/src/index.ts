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

export const api = (client: ReturnType<typeof App>) => ({
  getContext: () => client(async ({ context }) => context),
  getHttpClient: () => client(async ({ httpClient }) => httpClient),
  refreshToken: () =>
    client(async ({ httpClient }) => {
      const token =
        httpClient?.defaults.headers.Authorization?.toString().split(' ')[1]

      const { data } = await httpClient.get<Token>('/token', {
        params: { account: mono.account, refreshToken: token },
      })

      return data
    }),
  getUserById: (id: string | number) =>
    client(async ({ httpClient, context, logger }) => {
      const usr = await httpClient.get<User>('/api/user', { params: { id } })
      context.users = (context.users ?? []).concat(usr.data)
      return usr.data
    }),
})

export default App

/**
 * usage
 */
async function main() {
  const app = App({
    account: mono.account,
    baseURL: mono.baseURL,
    context: {},
    logger,
  })

  const client = api(app)
  await client.getUserById('123')
  await client.getUserById('345')

  console.log('waiting')

  setTimeout(async () => {
    await client.getUserById('789')
  }, 70 * 1000)

  const state = await client.getContext()

  console.log(state)
}

main()
