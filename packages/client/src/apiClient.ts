import axios, { type AxiosInstance } from 'axios'

type Required<T> = {
  [P in keyof T]-?: T[P]
}

type Func = (...args: unknown[]) => void

export type Config<Context, Logger extends Func> = {
  baseURL: string
  account: string
  context: Context
  httpClient?: AxiosInstance
  logger: Logger
}

export type Token = { token: string }

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
    response => response,
    async error => {
      // handle 401 responses
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
            return Promise.reject(refreshError)
          }
        }
      }

      return Promise.reject(error)
    },
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
    try {
      if (!config.httpClient) {
        const client = await createAxios(config)
        config.httpClient = client
      }

      return query({ ...config, httpClient: config.httpClient })
    } catch (e) {
      config.logger(e)
    }
  }
