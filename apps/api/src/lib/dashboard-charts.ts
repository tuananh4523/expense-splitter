import { prisma } from '@expense/database'
import dayjs from 'dayjs'

export async function computePersonalExpenseCharts(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const start = dayjs(startDate).startOf('day')
  const end = dayjs(endDate).endOf('day')

  const splits = await prisma.expenseSplit.findMany({
    where: {
      userId,
      isExcluded: false,
      expense: {
        expenseDate: {
          gte: start.toDate(),
          lte: end.toDate(),
        },
        status: 'ACTIVE', // [Fix 1]
      },
    },
    include: {
      expense: {
        include: {
          category: true,
        },
      },
    },
  })

  // --- 1. LINE CHART ---
  const dailyDataMap = new Map<string, number>()
  
  // [Fix 4] Fill ngày trống
  let currentDay = start.clone()
  while (currentDay.isBefore(end) || currentDay.isSame(end, 'day')) {
    dailyDataMap.set(currentDay.format('YYYY-MM-DD'), 0)
    currentDay = currentDay.add(1, 'day')
  }

  // --- 2. PIE CHART ---
  const categoryDataMap = new Map<
    string,
    { name: string; color: string; amount: number }
  >()

  // Logic processing
  for (const split of splits) {
    const amountNum = Number(split.amount) // [Fix 2] Decimal -> number
    
    // YYYY-MM-DD local timezone [Fix 6]
    const dateStr = dayjs(split.expense.expenseDate).format('YYYY-MM-DD')
    
    // Add to daily data
    if (dailyDataMap.has(dateStr)) {
      dailyDataMap.set(dateStr, dailyDataMap.get(dateStr)! + amountNum)
    }

    // Pie chart category data [Fix 3]
    const category = split.expense.category
    const catId = category?.id || 'other'
    const catName = category?.name || 'Khác'
    const catColor = category?.color || '#cbd5e1'

    const currentCat = categoryDataMap.get(catId) || { name: catName, color: catColor, amount: 0 }
    currentCat.amount += amountNum
    categoryDataMap.set(catId, currentCat)
  }

  // --- Transform Line Chart Data ---
  const lineChartData = Array.from(dailyDataMap.entries())
    .map(([date, amount]) => ({
      date,
      amount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date)) // [Fix 5] Sort theo time

  // --- Transform Pie Chart Data [Fix 8] Top 5 + Khác ---
  const allPieData = Array.from(categoryDataMap.values())
    .sort((a, b) => b.amount - a.amount)

  let pieChartData: Array<{ name: string; color: string; amount: number }> = []

  if (allPieData.length <= 6) {
    pieChartData = allPieData
  } else {
    // Top 5 and aggregate the rest
    const top5 = allPieData.slice(0, 5)
    const rest = allPieData.slice(5)
    
    const restAmount = rest.reduce((sum, item) => sum + item.amount, 0)
    
    pieChartData = [
      ...top5,
      { name: 'Khác', color: '#cbd5e1', amount: restAmount }
    ]
  }

  return {
    lineChartData,
    pieChartData,
  }
}
