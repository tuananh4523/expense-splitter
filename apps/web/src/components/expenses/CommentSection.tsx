import { FileUpload } from '@/components/shared/FileUpload'
import { ResolvedImageList } from '@/components/shared/ResolvedImageList'
import { useAddComment, useComments, useDeleteComment } from '@/hooks/useExpenses'
import { fmtDate } from '@/utils/date'
import { DeleteOutlined, UserOutlined } from '@ant-design/icons'
import { App, Avatar, Button, Form, Input, List, Popconfirm } from 'antd'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

export function CommentSection({ groupId, expenseId }: { groupId: string; expenseId: string }) {
  const { message } = App.useApp()
  const { data: session } = useSession()
  const { data: comments = [], isLoading } = useComments(groupId, expenseId)
  const add = useAddComment(groupId, expenseId)
  const del = useDeleteComment(groupId, expenseId)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])

  const submit = async () => {
    const t = content.trim()
    if (!t && images.length === 0) {
      message.warning('Nhập nội dung hoặc đính ảnh')
      return
    }
    try {
      await add.mutateAsync({ content: t || ' ', imageUrls: images })
      setContent('')
      setImages([])
      message.success('Đã gửi bình luận')
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Không gửi được')
    }
  }

  return (
    <div className="space-y-4">
      <List
        loading={isLoading}
        dataSource={comments}
        locale={{ emptyText: 'Chưa có bình luận' }}
        renderItem={(c) => (
          <List.Item
            actions={
              session?.user?.id === c.user.id
                ? [
                    <Popconfirm
                      key="del"
                      title="Xoá bình luận?"
                      onConfirm={() => {
                        void del.mutateAsync(c.id).then(
                          () => message.success('Đã xoá'),
                          (e) => message.error(e instanceof Error ? e.message : 'Lỗi'),
                        )
                      }}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        aria-label="Xoá"
                      />
                    </Popconfirm>,
                  ]
                : []
            }
          >
            <List.Item.Meta
              avatar={<Avatar src={c.user.avatarUrl ?? undefined} icon={<UserOutlined />} />}
              title={
                <span className="text-sm">
                  <span className="font-medium">{c.user.name}</span>
                  <span className="ml-2 text-gray-400">{fmtDate(c.createdAt)}</span>
                  {c.isEdited ? <span className="text-gray-400"> · đã sửa</span> : null}
                </span>
              }
              description={
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap text-gray-800">{c.content}</p>
                  {c.imageUrls?.length ? <ResolvedImageList urls={c.imageUrls} compact /> : null}
                </div>
              }
            />
          </List.Item>
        )}
      />

      <Form layout="vertical" className="border-t border-gray-100 pt-4">
        <Form.Item label="Bình luận mới">
          <Input.TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Nội dung…"
          />
        </Form.Item>
        <Form.Item label="Ảnh (tuỳ chọn)">
          <FileUpload value={images} onChange={setImages} groupId={groupId} uploadType="expense" />
        </Form.Item>
        <Button type="primary" onClick={() => void submit()} loading={add.isPending}>
          Gửi
        </Button>
      </Form>
    </div>
  )
}
