import { withAuth } from '@/utils/withAuth'
import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = withAuth(async () => ({
  redirect: { destination: '/dashboard', permanent: false },
}))

export default function Home() {
  return null
}
