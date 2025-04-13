import { AxiosError } from 'axios'

export function logger<T>(...args: T[]) {
  const [e] = args
  if (e instanceof AxiosError) {
    console.error(
      `[${e.status} ${e.code}] "${e.response?.data.error}" ${e.message}`,
    )
  } else {
    console.error('Unknown error', JSON.stringify(e))
  }
}

export type Logger = typeof logger
