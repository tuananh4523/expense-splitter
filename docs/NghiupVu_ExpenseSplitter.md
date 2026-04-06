# Nghiệp vụ Expense Splitter - Chi tiết Quy trình & Chức năng

## 1. Đăng ký / Đăng nhập (Auth)

### Quy trình:
```
User → POST /auth/register {email, name, password}
  ↓ bcrypt hash
Tạo User(isActive=true, role=USER, mustChangePassword=false)
← {id, email, name} (201)

User → POST /auth/login {email, password}
  ↓ findUnique + bcrypt.compare
  ↓ tạo UserSession(jti=UUID, deviceLabel?, ip?)
  ↓ sign JWT(sub=userId, role, jti, exp=7d)
← {token, user: {id,email,name,avatarUrl(signed),role}}
```
**Chức năng**: 
- Admin POST /admin/users {email,name,password,role} → tạo user
- Admin POST /admin/users/:id/reset-password → set mustChangePassword=true
- Auto update lastLoginAt
- Idle timeout (SystemConfig)

## 2. Quản lý Nhóm (Groups)

### Tạo nhóm:
```
Leader → POST /groups {name, desc?, icon?, color?, requireApproval?}
  ↓ auto generate inviteCode(25 chars)
Tạo Group(isActive=true, inviteEnabled=true)
Tạo GroupFund(balance=0, lowThreshold=0)
Tạo self GroupMember(role=LEADER)
ActivityLog: GROUP_CREATED
← GroupDto(myRole=LEADER, fundBalance='0.00')
```

### Tham gia nhóm:
```
User → POST /groups/join {inviteCode}
  ↓ find Group(inviteEnabled && !expired && isActive)
  ↓ if requireApproval:
    → upsert GroupJoinRequest(PENDING)
    Leader/phó → POST /join-requests/:id/approve → MEMBER + ActivityLog
  ↓ else:
    → upsert GroupMember(isActive=true, role=MEMBER)
ActivityLog: MEMBER_JOINED_INVITE
```

### Mời thành viên:
```
Leader/phó → POST /groups/:id/members {email}
  ↓ findUser(email)
  ↓ if not member && no PENDING invite:
    Tạo GroupInvite(PENDING)
    Notify invitee: GROUP_INVITE
ActivityLog: MEMBER_INVITED
Invitee → POST /invites/:id/accept → MEMBER
```

### Quản lý thành viên:
```
Leader → PATCH /members/:id {role=VICE_LEADER|MEMBER}
Leader → DELETE /members/:id → isActive=false, leftAt=now
MEMBER → POST /leave → self soft-delete
ActivityLog tương ứng
```

## 3. Chi tiêu (Expenses)

### Tạo chi:
```
MEMBER → POST /groups/:id/expenses {
  title, amount, paidByUserId?(self), categoryId?, 
  splitType=EQUAL(default), splits?, expenseDate=now, 
  tags[], imageUrls[], isStandalone?, recurringDays?, desc?
}
  ↓ validate: paidBy∈members, sum(split)==amount
Tạo Expense(ACTIVE)
Tạo ExpenseSplit (EQUAL: chia đều active members)
if isStandalone:
  Tạo StandalonePayment + PaymentRecord(PENDING, payer=split.user, receiver=paidBy)
if recurringDays:
  Tạo RecurringExpense(nextRunAt=+interval)
AuditLog + ActivityLog: EXPENSE_CREATED
```

### Cập nhật/Xóa:
```
PATCH /expenses/:id → chỉ ACTIVE (không SETTLED/DONE)
  Rebuild splits nếu thay đổi
  Adjust StandalonePayment nếu đổi paidBy/isStandalone
DELETE → chỉ ACTIVE, cascade cleanup
```

### Bình luận:
```
POST /expenses/:id/comments {content, imageUrls[]}
DELETE own comment
_count → expense.commentCount
```

## 4. Chi riêng lẻ (StandalonePayment)

```
1. Payer → POST /standalone/payments/:id/confirm {proofImageUrls[], comment?}
   → status=CONFIRMED
2. Receiver/Leader → POST /accept {accepted?, comment?}
   → ACCEPTED | REJECTED (chỉ CONFIRMED)
3. All ACCEPTED → StandalonePayment.ACCEPTED + Expense.STANDALONE_DONE
```
**Nhắc nhở**:
- Payer request-review → notify receiver+leaders
- Leader notify-payer (PENDING)
- Reopen-after-reject (PAYER/Leader)

## 5. Tổng kết (Settlement)

### Preview:
```
POST /settlements/preview {periodStart, periodEnd}
→ computeGroupSettlementPreview():
  Expenses(ACTIVE, !standalone, in period)
  → balances(net=paid-owed+fund_net_period)
  → transactions (minimize flows)
  → suggestedReceiver (max credit)
← {balances[], transactions[], totalAmount, periodExpensesTotal}
```

### Tạo tổng kết:
```
Leader → POST /settlements {title, periodStart/end, receiverUserId}
  ↓ compute preview + validate receiver∈candidates
Tạo Settlement(PENDING, summaryData=balances+tx+expenses)
Tạo PaymentRecord(PENDING) từ transactions
Update expense.settlementId → lock
if 0 tx → auto COMPLETED + Expense.SETTLED + clearFundLedger
Notify participants: SETTLEMENT_CREATED
ActivityLog
```

### Thanh toán tổng kết:
```
1. Payer → /payments/:id/confirm → CONFIRMED + proof
2. Receiver/Leader → /accept → ACCEPTED | REJECTED
3. All ACCEPTED → COMPLETED + Expense.SETTLED + clearFundLedger
```
**Leader tools**: notify-pending-payers, DELETE (chỉ PENDING/0đ)

## 6. Quỹ nhóm (GroupFund)

```
1. Leader → POST /fund → init
2. MEMBER → POST /contribute {amount, note?, proofImageUrls[]}
   → FundTransaction(CONTRIBUTE, PENDING)
   Notify leaders: FUND_CONTRIBUTED
3. Leader/phó/Admin → POST /:txId/approve → APPROVED + balance+=amount
   | POST /reject {note?} → REJECTED
ActivityLog
4. Leader → PATCH /fund {lowThreshold}
```
**Settlement integration**: clear DEDUCT/REFUND cũ khi COMPLETED.

## 7. Dashboard & Thống kê

```
GET /dashboard/summary → computeDashboardSummaryForUser():
  participatingGroups, totalDebt/credit(all groups), pendingSettlementCount
GET /charts?startDate&endDate(30d) → personal expense charts
```
**FE**: Cards (nhóm/nợ/được nợ/pending) + charts.

## 8. Thông báo (Notifications)

```
Types: SETTLEMENT_CREATED, PAYMENT_REQUEST/CONFIRMED/ACCEPTED/REJECTED, 
FUND_CONTRIBUTED/LOW_BALANCE, MEMBER_JOINED/LEFT, EXPENSE_ADDED, 
GROUP_INVITE, SYSTEM_ANNOUNCEMENT(broadcast)
GET paginated unread first
Realtime Socket.io
```

## 9. Upload & Storage

```
POST /upload/presign {filename, contentType=image/*, groupId?, type}
→ signed PUT URL (MinIO) + permanent viewUrl
Signed GET cho avatar/proof (private bucket)
Limits: MAX_IMAGE_UPLOAD_BYTES
```

## 10. Admin & System

```
- POST /admin/broadcast → SYSTEM_ANNOUNCEMENT (excludeUsers?)
- PATCH /system {idleTimeoutMinutes=0-10080}
- GET/PATCH /feedbacks (PRAISE/ISSUE)
- AuditLog + GroupActivityLog (immutable)
```

## Quyền hạn & Gates
- **Auth**: JWT middleware → ctx.userId/role
- **GroupGate**: resolveGroupReadAccess/WriteAccess (member/leader)
- **Admin**: role=ADMIN bypass group gates
- **FundReview**: Leader/Vice/Admin

## Realtime & Cleanup
- Socket.io: /groups/:id → activity/notifications
- StorageCleanup: cron delete orphaned images
- clearGroupFundLedger: khi settlement COMPLETED

**Deployment**: Docker Compose (API+DB+MinIO+Redis), pnpm dev.

Demo seed: adminta@gmail.com / 1234567 | ADMIN@gmail.com / 1234567
