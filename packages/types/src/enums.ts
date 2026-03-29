export const SplitType = {
  EQUAL: 'EQUAL',
  UNEQUAL: 'UNEQUAL',
  PERCENTAGE: 'PERCENTAGE',
} as const
export type SplitType = (typeof SplitType)[keyof typeof SplitType]

export const ExpenseStatus = {
  ACTIVE: 'ACTIVE',
  SETTLED: 'SETTLED',
  STANDALONE_DONE: 'STANDALONE_DONE',
} as const
export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus]

export const SettlementStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
} as const
export type SettlementStatus = (typeof SettlementStatus)[keyof typeof SettlementStatus]

export const PaymentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const GroupRole = {
  LEADER: 'LEADER',
  VICE_LEADER: 'VICE_LEADER',
  MEMBER: 'MEMBER',
} as const
export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole]
