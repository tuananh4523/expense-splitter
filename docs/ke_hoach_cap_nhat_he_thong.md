# Cập nhật Hệ thống: Nhắc nợ tự động, Soft Delete & Categorize Cá Nhân

Dự định cập nhật hệ thống để hỗ trợ 3 tính năng chính được người dùng yêu cầu:
1. **Nhắc nợ tự động (Cron job)**
2. **Audit log & Soft Delete cho Expense (Xóa mềm có thể khôi phục)**
3. **Danh mục chi tiêu nhóm tùy chỉnh (Group Custom Categories)**

## User Review Required

> [!WARNING]
> Thay đổi này có tác động sâu tới `schema.prisma`. Việc sửa ràng buộc `@unique` trên bảng `Category` cần được thực hiện cẩn thận để tránh lỗi trong quá trình migration dữ liệu cũ. Anh/chị xem chi tiết bên dưới.

## Proposed Changes

### Database Schema (packages/database/prisma/schema.prisma)

#### [MODIFY] schema.prisma
- **NotificationType enum**: Bổ sung giá trị `DEBT_OVERDUE`.
- **Group model**: Bổ sung cấu hình nhắc nợ: `debtReminderEnabled Boolean @default(false)` và `debtReminderDays Int @default(7)`.
- **Expense model**: Bổ sung `deletedAt DateTime?` để hỗ trợ xóa mềm (Soft Delete).
- **Category model**: 
  - Bổ sung `groupId String?`, thiết lập liên kết n-1 tới `Group`.
  - Thay thế ràng buộc `@unique` trên cột `name` bằng `@@unique([groupId, name])` để cho phép các nhóm khác nhau có cùng tên danh mục.

---

### Backend API (apps/api)

#### [NEW] src/services/cron.service.ts
- Viết cron job chạy tự động.
- Nhiệm vụ 1: Lấy danh sách các `Expense` ở trạng thái `ACTIVE` chưa được thanh toán, quá hạn so với cấu hình `debtReminderDays` của từng `Group`. Gửi thông báo `DEBT_OVERDUE`.
- Nhiệm vụ 2: Lấy các `Expense` có `deletedAt != null` và `deletedAt < now() - 14 days` (hoặc 30 days), tiến hành xóa vĩnh viễn (Hard Delete) khỏi database.

#### [MODIFY] src/routes/expense.route.ts & liên quan
- **Cập nhật Logic Xóa (Delete Expense)**: Chuyển từ xóa cứng sang gán `deletedAt = now()`. Ghi dữ liệu vào `AuditLog` trước và sau khi thực hiện.
- **Cập nhật Logic Cập nhật (Update Expense)**: Lưu snapshot dữ liệu (before/after JSON) vào `AuditLog` cho từng lệnh sửa.
- **RESTORE (Khôi phục)**: Viết thêm API endpoint `POST /expenses/:id/restore` để gán lại `deletedAt = null` kèm theo ghi log. Các khoản chi khi ở trạng thái Soft Deleted sẽ không được tính toán trong tổng kết (`Settlement`).

#### [MODIFY] src/routes/category.route.ts
- Cho phép truyền vào `groupId` khi tạo danh mục mới.
- Cập nhật API GET categories để lấy cả phân loại mặc định (System Categories `groupId = null`) + danh mục riêng của nhóm.

---

### Frontend (apps/client)

#### [MODIFY] Quản lý Danh mục Nhóm
- Bổ sung UI trong phần thiết lập nhóm để người dùng có thể Thêm/Sửa/Xóa các Danh mục tùy chỉnh (Custom categories).

#### [MODIFY] Quản lý Expense
- Tại giao diện Danh sách Chi Tiêu: ẩn các khoản chi đã xóa mềm.
- **Thùng rác nhóm (Trash):** Thêm mục quản lý các khoản chi đã xóa **tại trang Lịch sử của Nhóm (Group Activity)**, cho phép khôi phục hoặc xóa vĩnh viễn khoản chi.
- Bổ sung View Audit Log chi tiết cho mỗi khoản chi ("Lịch sử chỉnh sửa").

## Open Questions

> [!IMPORTANT]
> - Cron job nên nhắc nợ hàng ngày vào 1 giờ cố định (vd: 8.00 sáng) hay chạy rải rác ạ?
> - **[Đã chốt]** Giao diện "Thùng rác" cho expense đã xoá để cho phép khôi phục sẽ nằm ở đâu? -> Nằm ở trang **Lịch sử của group** (Group Activity).
> - Đối với danh mục tuỳ chỉnh của nhóm, người quản lý nhóm (Leader) hay ai cũng có quyền tạo/xóa danh mục cá nhân của nhóm ạ?

## Verification Plan

### Automated Tests
- Kiểm tra migration Prisma có drop unique index và tạo mới bị lỗi không.
- Chạy thử Cronjob lấy danh sách cảnh báo nợ.

### Manual Verification
- Sửa/Xóa khoản chi ngẫu nhiên và kiểm tra dữ liệu Before/After JSON có được lưu chính xác vào DB.
- Cố tình xóa 1 khoản, vào thùng rác khôi phục.
