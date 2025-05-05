import axios, {
  type AxiosError,
  type AxiosInstance,
  HttpStatusCode,
} from 'axios'

type Required<T> = {
  [P in keyof T]-?: T[P]
}

type Func = (...args: unknown[]) => void

export type Config<Context, Logger extends Func> = {
  baseURL: string
  account: string
  context: Context
  httpClient?: AxiosInstance
  retries: number
  delay: {
    type: 'linear' | 'exponential'
    base: number
  }
  logger: Logger
}

export type Token = { token: string }

const handleRefreshToken_401 = async <Context, Logger extends Func>(
  error: AxiosError,
  config: Config<Context, Logger>,
  client: AxiosInstance,
) => {
  if (!error.response || !error.config) {
    throw error
  }

  if (error.response?.status === 401) {
    console.warn('Token expired, refreshing token...')
    const token =
      client.defaults.headers.Authorization?.toString().split(' ')[1]

    if (token) {
      try {
        const { data } = await axios.get<Token>(`${config.baseURL}/token`, {
          params: { account: config.account, refreshToken: token },
        })

        // Update the Authorization header with the new token
        client.defaults.headers.Authorization = `Bearer ${data.token}`

        // Retry the original request with the new token
        error.config.headers.Authorization = `Bearer ${data.token}`
        return client.request(error.config)
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError)
        throw refreshError
      }
    }
  }

  throw error
}

const handleRetry_500 = async <Context, Logger extends Func>(
  error: AxiosError,
  config: Config<Context, Logger>,
  client: AxiosInstance,
) => {
  if (!error.response || !error.config) {
    throw error
  }

  if (error.response.status >= HttpStatusCode.InternalServerError) {
    if (error.config.method?.toUpperCase() === 'POST') {
      throw error
    }

    let retries = config.retries
    const { base, type } = config.delay

    while (retries > 0) {
      try {
        const delay =
          type === 'exponential' ? base * 2 ** (config.retries - retries) : base
        await new Promise(resolve => setTimeout(resolve, delay))

        // Retry the original request
        return await client.request(error.config)
      } catch (retryError) {
        retries -= 1

        if (retries === 0) {
          throw retryError
        }
      }
    }
  }

  throw error
}

const errorInterceptor =
  <Context, Logger extends Func>(
    config: Config<Context, Logger>,
    client: AxiosInstance,
  ) =>
  async (error: AxiosError) => {
    try {
      await handleRefreshToken_401(error, config, client)
      await handleRetry_500(error, config, client)
    } catch (e) {
      return Promise.reject(e)
    }
  }

const createAxios = async <Context, Logger extends Func>(
  config: Config<Context, Logger>,
): Promise<AxiosInstance> => {
  const { data } = await axios.get<Token>(`${config.baseURL}/token`, {
    params: { account: config.account },
  })

  const client = axios.create({
    baseURL: config.baseURL,
    headers: {
      Authorization: `Bearer ${data.token}`,
    },
  })

  client.interceptors.response.use(
    success => success,
    errorInterceptor(config, client),
  )

  return client
}

/**
 * Instantiates the httpClient
 *
 * @param config
 * @returns query builder
 */
export const apiClient =
  <Context, Logger extends Func>(config: Config<Context, Logger>) =>
  async <T>(
    query: (config: Required<Config<Context, Logger>>) => Promise<T>,
  ) => {
    if (!config.httpClient) {
      const client = await createAxios(config)
      config.httpClient = client
    }

    return query({ ...config, httpClient: config.httpClient })
  }
