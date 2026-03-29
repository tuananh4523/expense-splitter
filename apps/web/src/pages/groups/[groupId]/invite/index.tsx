import { withAuth } from '@/utils/withAuth'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export const getServerSideProps = withAuth()

/** Giữ URL cũ: chuyển sang cùng màn hình tham gia nhóm (/join) như link mã mời. */
export default function GroupInviteRedirectPage() {
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''

  useEffect(() => {
    if (!router.isReady || !groupId) return
    void router.replace(`/join?group=${encodeURIComponent(groupId)}`)
  }, [router, groupId])

  return null
}
