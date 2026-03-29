import 'next-auth'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { id: string; role: string }
    accessToken: string
  }

  interface User {
    id: string
    role: string
    accessToken: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    accessToken: string
    email?: string | null
    name?: string | null
    picture?: string | null
  }
}
