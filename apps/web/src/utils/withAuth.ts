import { authOptions } from '@/lib/auth'
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth'

export function withAuth(
  callback?: (
    ctx: GetServerSidePropsContext,
    session: Session,
  ) => Promise<GetServerSidePropsResult<Record<string, unknown>>>,
): GetServerSideProps {
  return async (ctx) => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions)
    if (!session?.user?.id) {
      return { redirect: { destination: '/auth/login', permanent: false } }
    }
    return callback ? callback(ctx, session) : { props: { session } }
  }
}

export const withGuest: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (session?.user?.id) {
    return { redirect: { destination: '/dashboard', permanent: false } }
  }
  return { props: {} }
}
