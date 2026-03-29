import { Button, Empty } from 'antd'

export function EmptyState({
  description,
  action,
  className,
}: {
  description: string
  action?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <Empty
      description={description}
      className={['empty-state', className].filter(Boolean).join(' ')}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    >
      {action ? (
        <Button type="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </Empty>
  )
}
