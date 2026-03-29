import { withAuth } from '@/utils/withAuth'

/** Đường dẫn cũ — chuyển sang danh sách nhóm và mở modal tạo nhóm. */
export const getServerSideProps = withAuth(async () => ({
  redirect: { destination: '/groups?create=1', permanent: false },
}))

export default function GroupNewLegacyRedirect() {
  return null
}
