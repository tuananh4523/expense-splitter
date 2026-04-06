import { useDashboardCharts } from '@/hooks/useDashboard'
import { Card, Col, DatePicker, Empty, Row, Skeleton, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const { RangePicker } = DatePicker

const defaultRange: [Dayjs, Dayjs] = [dayjs().subtract(30, 'd'), dayjs()]

const rangePresets = [
  { label: '30 ngày qua', value: defaultRange },
  {
    label: 'Tháng này',
    value: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs],
  },
  {
    label: 'Tháng trước',
    value: [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ] as [Dayjs, Dayjs],
  },
  { label: 'Năm nay', value: [dayjs().startOf('year'), dayjs().endOf('year')] as [Dayjs, Dayjs] },
]

export function ExpenseCharts() {
  const [dates, setDates] = useState<[Dayjs, Dayjs]>(defaultRange)

  const { data, isLoading, isError } = useDashboardCharts(dates[0]?.toDate(), dates[1]?.toDate())

  const formattedLineData = useMemo(() => {
    if (!data?.lineChartData) return []
    return data.lineChartData.map((item) => ({
      ...item,
      amountNum: Number(item.amount),
      displayDate: dayjs(item.date).format('DD/MM'),
    }))
  }, [data])

  const formattedPieData = useMemo(() => {
    if (!data?.pieChartData) return []
    return data.pieChartData
      .map((item) => ({ ...item, amountNum: Number(item.amount) }))
      .filter((item) => item.amountNum > 0)
  }, [data])

  return (
    <Card className="mb-8" styles={{ body: { padding: '20px 24px' } }}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Typography.Title level={5} className="!m-0">
          Chi tiêu cá nhân
        </Typography.Title>
        <RangePicker
          presets={rangePresets}
          value={dates}
          onChange={(val) => {
            if (val?.[0] && val?.[1]) setDates([val[0], val[1]])
          }}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
          format="DD/MM/YYYY"
        />
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : isError ? (
        <Typography.Text type="danger">Không thể tải dữ liệu biểu đồ.</Typography.Text>
      ) : (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <div className="h-[300px] w-full">
              {formattedLineData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Empty description="Không có chi tiêu nào trong khoảng thời gian này" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={formattedLineData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="displayDate"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      tickFormatter={(val) =>
                        new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(val)
                      }
                    />
                    <Tooltip
                      formatter={(val: number) => [
                        new Intl.NumberFormat('vi-VN', {
                          style: 'currency',
                          currency: 'VND',
                        }).format(val),
                        'Chi tiêu',
                      ]}
                      labelFormatter={(label) => `Ngày: ${label}`}
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amountNum"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 6, stroke: '#4F46E5', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="flex h-[320px] w-full flex-col">
              {formattedPieData.length === 0 ? (
                <div className="flex h-full flex-1 items-center justify-center">
                  <Typography.Text type="secondary">Chưa có danh mục</Typography.Text>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={formattedPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="amountNum"
                          nameKey="name"
                        >
                          {formattedPieData.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) =>
                            new Intl.NumberFormat('vi-VN', {
                              style: 'currency',
                              currency: 'VND',
                            }).format(val)
                          }
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-3 overflow-y-auto max-h-[60px] pb-1">
                    {formattedPieData.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-1.5 text-xs text-slate-600"
                      >
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate max-w-[80px]" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Col>
        </Row>
      )}
    </Card>
  )
}
