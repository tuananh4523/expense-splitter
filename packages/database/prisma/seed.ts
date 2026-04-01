import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── System categories (Iconify mdi — cùng định dạng với IconPicker / UI) ──
  const categories = [
    { name: 'Ăn uống', icon: 'mdi:food-takeout-box-outline', color: '#FF6B6B', isSystem: true },
    { name: 'Đi chơi', icon: 'mdi:gamepad-variant-outline', color: '#4ECDC4', isSystem: true },
    { name: 'Xăng xe', icon: 'mdi:gas-station-outline', color: '#45B7D1', isSystem: true },
    { name: 'Chợ / Siêu thị', icon: 'mdi:shopping-outline', color: '#96CEB4', isSystem: true },
    { name: 'Nhà hàng', icon: 'mdi:chef-hat', color: '#FFEAA7', isSystem: true },
    { name: 'Điện nước', icon: 'mdi:lightbulb-outline', color: '#DDA0DD', isSystem: true },
    { name: 'Khác', icon: 'mdi:package-variant-closed', color: '#B0B0B0', isSystem: true },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon, color: cat.color, isSystem: cat.isSystem },
      create: cat,
    })
  }

  // ── Test users ───────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 12)

  const admin = await prisma.user.upsert({
    where: { email: 'adminta@gmail.com' },
    update: {
      passwordHash: await hash('1234567'),
      isActive: true,
      name: 'Admin User',
      role: 'ADMIN',
    },
    create: {
      email: 'adminta@gmail.com',
      name: 'Admin User',
      passwordHash: await hash('1234567'),
      role: 'ADMIN',
    },
  })

  // const user1 = await prisma.user.upsert({
  //   where: { email: 'alice@test.com' },
  //   update: {
  //     passwordHash: await hash('user123'),
  //     isActive: true,
  //     name: 'Alice Nguyễn',
  //   },
  //   create: {
  //     email: 'alice@test.com',
  //     name: 'Alice Nguyễn',
  //     passwordHash: await hash('user123'),
  //   },
  // })

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@test.com' },
    update: {
      passwordHash: await hash('user123'),
      isActive: true,
      name: 'Bob Trần',
    },
    create: {
      email: 'ADMIN@gmail.com',
      name: 'TUAN ANH',
      passwordHash: await hash('1234567'),
    },
  })

  // ── Demo group ───────────────────────────────────
  const group = await prisma.group.upsert({
    where: { inviteCode: 'demo-group-001' },
    update: {},
    create: {
      name: 'Nhóm Demo',
      description: 'Nhóm test cho development',
      inviteCode: 'demo-group-001',
      fund: { create: { balance: 500000, lowThreshold: 100000 } },
    },
  })

  // Add members
  for (const [userId, role] of [
    [admin.id, 'LEADER'],
    // [user1.id, 'MEMBER'],
    [user2.id, 'MEMBER'],
  ] as const) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      update: {},
      create: { groupId: group.id, userId, role },
    })
  }

  console.log('Seed complete.')
  console.log('adminta@gmail.com/ 1234567')
  // console.log('  alice@test.com / user123')
  console.log('ADMIN@gmail.com/ 1234567')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
