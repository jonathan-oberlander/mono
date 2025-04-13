import * as dotenv from 'dotenv'
import { resolve } from 'node:path'

dotenv.config({ path: resolve(__dirname, '.env') })

export const mono = {
  baseURL: process.env.BASE_URL ?? '',
  account: process.env.ACCOUNT ?? '',
  tokenExpiration: Number(process.env.TOKEN_EXPIRATION_MINUTES) ?? 10,
} as const
