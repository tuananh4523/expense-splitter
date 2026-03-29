import { authOptions } from '@/lib/auth'
import { fetchUserRoleFromAccessToken } from '@/lib/serverUserRole'
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth'

export function withAdmin(
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
    const liveRole =
      session.accessToken != null && session.accessToken.length > 0
        ? await fetchUserRoleFromAccessToken(session.accessToken)
        : null
    const effectiveRole = liveRole ?? session.user.role
    if (effectiveRole !== 'ADMIN') {
      return { redirect: { destination: '/dashboard', permanent: false } }
    }
    return callback ? callback(ctx, session) : { props: { session } }
  }
}
