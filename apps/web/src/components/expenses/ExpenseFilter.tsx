import { CategoryLabel } from '@/components/expenses/CategoryLabel'
import { useCategories } from '@/hooks/useExpenses'
import type { ExpenseFilterInput } from '@expense/types'
import { Col, DatePicker, Form, Row, Select } from 'antd'
import dayjs from 'dayjs'

export function ExpenseFilter({
  groupId,
  value,
  onChange,
}: {
  groupId: string
  value: Partial<ExpenseFilterInput>
  onChange: (next: Partial<ExpenseFilterInput>) => void
}) {
  const { data: categories = [] } = useCategories(groupId)

  const emit = (patch: Partial<ExpenseFilterInput>, clear?: (keyof ExpenseFilterInput)[]) => {
    const next = { ...value, page: 1, ...patch }
    if (clear) for (const k of clear) delete next[k]
    onChange(next)
  }

  const scopeValue =
    value.standaloneIncomplete === true
      ? 'standalone_incomplete'
      : value.includeDeleted === true && value.deletedOnly === true
        ? 'deleted'
        : 'all'

  return (
    <Form layout="vertical" className="expense-filter-form">
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Form.Item label="Từ ngày" className="!mb-0">
            <DatePicker
              className="w-full"
              format="DD/MM/YYYY"
              value={value.dateFrom ? dayjs(value.dateFrom) : null}
              onChange={(d) =>
                d
                  ? emit({ dateFrom: d.toISOString() }, ['standaloneIncomplete'])
                  : emit({}, ['dateFrom'])
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Form.Item label="Đến ngày" className="!mb-0">
            <DatePicker
              className="w-full"
              format="DD/MM/YYYY"
              value={value.dateTo ? dayjs(value.dateTo) : null}
              onChange={(d) =>
                d
                  ? emit({ dateTo: d.toISOString() }, ['standaloneIncomplete'])
                  : emit({}, ['dateTo'])
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Form.Item label="Danh mục" className="!mb-0">
            <Select
              allowClear
              showSearch
              placeholder="Tất cả"
              className="w-full"
              options={categories.map((c) => ({
                value: c.id,
                label: (
                  <CategoryLabel name={c.name} icon={c.icon} color={c.color} iconSize={16} />
                ),
              }))}
              filterOption={(input, opt) => {
                const cat = categories.find((c) => c.id === opt?.value)
                if (!cat) return false
                return cat.name.toLowerCase().includes(input.trim().toLowerCase())
              }}
              value={value.categoryId ?? null}
              onChange={(v) =>
                v ? emit({ categoryId: v }, ['standaloneIncomplete']) : emit({}, ['categoryId'])
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Form.Item label="Trạng thái" className="!mb-0">
            <Select
              allowClear
              placeholder="Tất cả"
              className="w-full"
              options={[
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'SETTLED', label: 'Đã tổng kết' },
                { value: 'STANDALONE_DONE', label: 'Chi riêng xong' },
              ]}
              value={value.status ?? null}
              onChange={(v) =>
                v ? emit({ status: v }, ['standaloneIncomplete']) : emit({}, ['status'])
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Form.Item label="Phạm vi" className="!mb-0">
            <Select
              className="w-full min-w-0"
              options={[
                { value: 'all', label: 'Tất cả chi tiêu' },
                {
                  value: 'standalone_incomplete',
                  label: 'Chi riêng — chưa xong thanh toán',
                },
                {
                  value: 'deleted',
                  label: 'Đã xóa',
                },
              ]}
              value={scopeValue}
              onChange={(v) =>
                v === 'standalone_incomplete'
                  ? emit({ standaloneIncomplete: true }, [
                      'dateFrom',
                      'dateTo',
                      'status',
                      'categoryId',
                      'isStandalone',
                      'paidByUserId',
                      'includeDeleted',
                      'deletedOnly',
                    ])
                  : v === 'deleted'
                    ? emit({ includeDeleted: true, deletedOnly: true }, ['standaloneIncomplete', 'status'])
                    : emit({ status: 'ACTIVE' }, ['standaloneIncomplete', 'includeDeleted', 'deletedOnly'])
              }
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )
}
