# Nghiệp vụ Expense Splitter — vai trò, luồng dữ liệu và quy tắc chức năng

Tài liệu mô tả **nghiệp vụ theo từng chức năng**: ai được làm gì, trạng thái nào cho phép thao tác nào, dữ liệu đi đâu. Phần cuối tóm tắt **kiểu thông báo** và **vai trò hệ thống**. Đây là tài liệu bổ sung cho `huong_dan_su_dung_expense_splitter.md` (hướng dẫn thao tác từng bước cho người dùng).

---

## Mục lục

1. [Đối tượng tham gia và vai trò](#1-đối-tượng-tham-gia-và-vai-trò)
2. [Xác thực và phiên làm việc](#2-xác-thực-và-phiên-làm-việc)
3. [Nhóm (Group)](#3-nhóm-group)
4. [Thành viên, mời và tham gia](#4-thành-viên-mời-và-tham-gia)
5. [Chi tiêu (Expense)](#5-chi-tiêu-expense)
6. [Xóa mềm, khôi phục, audit và dọn dữ liệu](#6-xóa-mềm-khôi-phục-audit-và-dọn-dữ-liệu)
7. [Chi riêng và thanh toán riêng (Standalone)](#7-chi-riêng-và-thanh-toán-riêng-standalone)
8. [Tổng kết (Settlement)](#8-tổng-kết-settlement)
9. [Quỹ nhóm (Group fund)](#9-quỹ-nhóm-group-fund)
10. [Nợ ước tính trên tổng quan / dashboard](#10-nợ-ước-tính-trên-tổng-quan--dashboard)
11. [Lịch sử: Group activity và audit chi](#11-lịch-sử-group-activity-và-audit-chi)
12. [Thông báo (Notification)](#12-thông-báo-notification)
13. [Tệp đính kèm và lưu trữ](#13-tệp-đính-kèm-và-lưu-trữ)
14. [Góp ý và cấu hình hệ thống](#14-góp-ý-và-cấu-hình-hệ-thống)
15. [Quản trị viên (ADMIN)](#15-quản-trị-viên-admin)
16. [Bảng tra cứu nhanh: chức năng × vai trò](#16-bảng-tra-cứu-nhanh-chức-năng--vai-trò)

---

## 1. Đối tượng tham gia và vai trò

### 1.1. Vai trò **trong hệ thống** (`User.role`)

| Vai trò | Mô tả ngắn |
|---------|------------|
| **USER** | Người dùng thông thường: tham gia nhóm, ghi chi, nhận thông báo. |
| **ADMIN** | Quản trị: quản lý user, nhóm, phát sóng, góp ý, một số thao tác đọc/duyệt vượt rào nhóm (theo API). |

### 1.2. Vai trò **trong nhóm** (`GroupMember.role`)

| Vai trò | Quyền nghiệp vụ tiêu biểu |
|---------|----------------------------|
| **LEADER** (Trưởng nhóm) | Tạo/sửa cấu hình nhóm, mã mời, **Cài đặt** nhóm; duyệt vào nhóm (kèm phó); duyệt quỹ; tạo tổng kết; nhắc thanh toán; đổi vai trò / vô hiệu thành viên; xóa nhóm (nếu có). |
| **VICE_LEADER** (Phó nhóm) | Giống trưởng cho nhiều luồng **duyệt** (quỹ, tham gia nhóm, chứng từ chi riêng/tổng kết tùy API); **không** có mục **Cài đặt** nhóm trên giao diện sidebar (chỉ trưởng). |
| **MEMBER** (Thành viên) | Ghi/sửa/xóa mềm chi (trong điều kiện trạng thái); nộp quỹ; thực hiện thanh toán theo vai trò payer/receiver; rời nhóm; bình luận chi. |

### 1.3. Người xem **admin** một nhóm

- Khi ADMIN xem nhóm nhưng **không** là thành viên, API có thể đánh dấu `adminViewer`: **chỉ đọc**, **không** tính các chỉ số “nợ/được nợ cá nhân” trên DTO nhóm cho người đó.

---

## 2. Xác thực và phiên làm việc

### 2.1. Đăng ký

- **Đầu vào:** email (duy nhất), tên, mật khẩu.
- **Đầu ra:** bản ghi `User` kích hoạt; có thể đăng nhập ngay sau khi đăng ký (tùy cấu hình email xác minh nếu sau này bổ sung).

### 2.2. Đăng nhập

- Xác thực mật khẩu (hash), tạo **phiên** (`UserSession`) với `jti`, có thể ghi nhận thiết bị / IP.
- **JWT** chứa `userId`, `role`, `jti`, thời hạn — dùng cho mọi API nhóm/chi/quỹ.

### 2.3. Đổi mật khẩu / reset

- User đổi mật khẩu khi biết mật khẩu cũ (hoặc luồng reset token nếu bật).
- **ADMIN** reset mật khẩu user → có thể đặt cờ bắt buộc đổi mật khẩu lần đăng nhập sau (`mustChangePassword`).

### 2.4. Khóa tài khoản

- `User.isActive = false` → đăng nhập / gọi API bị từ chối theo luật middleware.

---

## 3. Nhóm (Group)

### 3.1. Tạo nhóm

- **Ai:** user đã đăng nhập (trở thành LEADER).
- **Hệ thống tạo:** `Group`, `GroupMember` (LEADER), `GroupFund` (số dư 0, ngưỡng cảnh báo 0), mã mời, cờ `inviteEnabled`, v.v.
- **Nhật ký:** ghi `GroupActivityLog` / audit tương ứng (vd. nhóm được tạo).

### 3.2. Cập nhật nhóm

- **Ai:** LEADER (API `PATCH /groups/:groupId`).
- **Có thể gồm:** tên, mô tả, avatar, icon, màu, `requireApproval`, cấu hình **nhắc nợ** (`debtReminderEnabled`, `debtReminderDays`).

### 3.3. Xóa nhóm

- **Ai:** LEADER (theo route xóa nhóm).
- **Hệ quả:** xóa dữ liệu nhóm theo cascade schema (cần cẩn trọng trên môi trường thật).

### 3.4. DTO nhóm trả về cho client

- Gồm `fundBalance` và **`fundLowThreshold`** (chuỗi decimal) để giao diện tô **đỏ cảnh báo** khi `fundBalance <= fundLowThreshold` và `fundLowThreshold > 0`.

---

## 4. Thành viên, mời và tham gia

### 4.1. Tham gia bằng **mã mời**

- User gửi mã hợp lệ, nhóm đang hoạt động, mời không hết hạn.
- **Nếu `requireApproval`:** tạo `GroupJoinRequest` trạng thái **PENDING**; **LEADER hoặc VICE_LEADER** duyệt → **APPROVED** thì tạo/kích hoạt `GroupMember` (MEMBER).
- **Nếu không duyệt:** thêm thành viên **MEMBER** trực tiếp.

### 4.2. Mời qua **email** (`GroupInvite`)

- LEADER/VICE gửi lời mời theo email người đã có tài khoản (luồng tìm user + tạo invite PENDING).
- Người được mời **chấp nhận** → trở thành thành viên; **từ chối** / hết hạn / thu hồi theo nghiệp vụ invite.

### 4.3. Quản lý thành viên

- **Đổi vai trò** (LEADER): MEMBER ↔ VICE_LEADER (trong giới hạn schema).
- **Vô hiệu hóa / xóa khỏi nhóm** (soft: `leftAt`, `isActive`): LEADER; thành viên có thể **tự rời nhóm** (`POST leave`).
- **Nghiệp vụ:** xóa thành viên **không** xóa lịch sử hoạt động đã ghi (log vẫn giữ tên/email snapshot thời điểm ghi).

---

## 5. Chi tiêu (Expense)

### 5.1. Tạo chi

- **Ai:** thành viên đang hoạt động trong nhóm.
- **Ràng buộc:** `paidByUserId` phải là thành viên hoạt động; tổng split khớp `amount` theo kiểu EQUAL / UNEQUAL / PERCENT.
- **Trạng thái ban đầu:** thường **ACTIVE**.
- **Chi riêng (`isStandalone`):** tạo thêm cấu trúc thanh toán riêng (`StandalonePayment` + các `PaymentRecord` PENDING) nối người trong split với người trả.

### 5.2. Cập nhật chi

- **Điều kiện:** chi **chưa** ở trạng thái **SETTLED**; chi riêng **chưa** **STANDALONE_DONE**.
- **Hệ thống:** cập nhật các `ExpenseSplit`, có thể điều chỉnh lại bản ghi thanh toán riêng nếu đổi payer / cờ standalone.

### 5.3. “Xóa” chi — **xóa mềm (soft delete)**

- **Điều kiện:** tương tự sửa — không xóa mềm chi **đã tổng kết** hoặc chi riêng **đã hoàn tất** thanh toán.
- **Hiệu ứng:** ghi `deletedAt`, `deletedByUserId`; chi **không** còn trong các truy vấn mặc định (`deletedAt IS NULL`).
- **Thông báo:** gửi loại **EXPENSE_DELETED** tới người trả, người trong split, trưởng nhóm (trừ người thực hiện xóa) — nội dung nhắc cửa sổ **khôi phục 7 ngày**.
- **Audit:** `AuditLog` + `GroupActivityLog` (hành động xóa chi).

### 5.4. Bình luận

- Thành viên đọc/ghi comment trên chi **chưa** xóa mềm (API lọc `deletedAt`).

### 5.5. Danh sách chi có **includeDeleted**

- Thành viên (hoặc admin xem nhóm) có thể yêu cầu danh sách **gồm** chi đã xóa mềm + tùy chọn **chỉ** chi đã xóa (`deletedOnly`) để hiển thị thùng khôi phục trên UI.

---

## 6. Xóa mềm, khôi phục, audit và dọn dữ liệu

### 6.1. Khôi phục

- **Trong 7 ngày** kể từ `deletedAt`: bất kỳ thành viên có quyền vào nhóm có thể gọi **restore** (theo route hiện tại).
- **Sau hạn:** API trả lỗi “quá hạn khôi phục”.
- **Không khôi phục** nếu trạng thái nghiệp vụ không cho (vd. đã SETTLED / STANDALONE_DONE — tùy kiểm tra server).
- **Thông báo:** **EXPENSE_RESTORED** cho cùng nhóm đối tượng như khi xóa (trừ người khôi phục).

### 6.2. Xóa cứng (hard delete)

- Job **cleanup** có thể xóa vĩnh viễn các chi đã xóa mềm **quá thời hạn lưu** (dự án cấu hình **7 ngày** sau xóa mềm — đồng bộ với cửa sổ khôi phục). Cần xác nhận khi vận hành production.

### 6.3. Audit chi

- Mỗi thao tác quan trọng (tạo, sửa, xóa mềm, khôi phục) ghi **AuditLog** kèm `before` / `after` (tùy hành động) và có thể ghi **IP**.
- Tab **Lịch sử** trong drawer chi tiết đọc từ API audit + mirror group activity nếu có.

---

## 7. Chi riêng và thanh toán riêng (Standalone)

### 7.1. Trạng thái bản ghi thanh toán (khái niệm)

1. **PENDING** — chưa có chứng từ xác nhận chuyển.
2. **CONFIRMED** — payer đã gửi ảnh chứng từ.
3. **ACCEPTED** / **REJECTED** — receiver (hoặc leader theo rule) duyệt.
4. Khi **mọi** bản ghi **ACCEPTED** → đánh dấu luồng standalone hoàn tất → `Expense.status = STANDALONE_DONE`.

### 7.2. Ai làm bước nào

| Bước | Thường là |
|------|-----------|
| Gửi chứng từ + xác nhận chuyển | **Payer** (người trong split phải trả cho người paidBy). |
| Duyệt / từ chối | **Receiver** (người nhận tiền trong bản ghi) và/hoặc **LEADER** (xem lại khi tranh chấp — theo API `accept`). |
| Nhắc / yêu cầu xem lại | Payer hoặc Leader tùy endpoint. |

### 7.3. Liên hệ với tổng kết

- Chi **standalone** **không** đưa vào preview tổng kết **chung** theo luồng đã triển khai (chỉ chi chung ACTIVE trong kỳ).

---

## 8. Tổng kết (Settlement)

### 8.1. Preview

- **Đầu vào:** `periodStart`, `periodEnd`.
- **Đầu ra:** số dư ròng từng thành viên, danh sách **giao dịch tối thiểu** (ai trả ai), tổng tiền, tổng chi chung trong kỳ, gợi ý **người nhận quỹ** (receiver).

### 8.2. Tạo đợt

- **Ai:** LEADER.
- **Hệ thống:** tạo `Settlement` (thường PENDING), snapshot `summaryData`, tạo các `PaymentRecord` theo từng luồng chuyển; **gán `settlementId`** cho expense trong kỳ → **khóa** chỉnh sửa/xóa thông thường.
- **Đặc biệt:** nếu **0** giao dịch cần thực hiện, đợt có thể **đóng ngay** và cập nhật trạng thái chi sang **SETTLED** (theo logic service).

### 8.3. Thanh toán đợt

- Tương tự standalone: payer **confirm** (ảnh bắt buộc) → receiver/leader **accept/reject**.
- Khi tất cả **ACCEPTED** → settlement **COMPLETED**, chi **SETTLED**, xử lý sổ quỹ kỳ (ledger) theo service `clearGroupFundLedger` / quy tắc hiện có.

### 8.4. Công cụ trưởng nhóm

- **Nhắc** người chưa nộp chứng từ / chưa xác nhận.
- **Xóa đợt** chỉ trong điều kiện an toàn (vd. PENDING, chưa phát sinh thanh toán — theo API).

---

## 9. Quỹ nhóm (Group fund)

### 9.1. Khởi tạo

- LEADER (hoặc luồng seed) tạo `GroupFund` gắn 1-1 với nhóm.

### 9.2. Nộp quỹ

- MEMBER tạo `FundTransaction` loại **CONTRIBUTE**, trạng thái **PENDING**, kèm ảnh chứng từ.
- **LEADER hoặc VICE_LEADER** (và ADMIN trong một số gate) **APPROVE** → cộng `balance`; **REJECT** → không cộng.

### 9.3. Ngưỡng cảnh báo `lowThreshold`

- LEADER cập nhật qua API cập nhật quỹ (PATCH fund / settings tùy route).
- Khi `balance <= lowThreshold` và `lowThreshold > 0`: UI tổng quan / trang quỹ tô **đỏ**; có thể phát **FUND_LOW_BALANCE** (nếu job/endpoint bật).

### 9.4. Trừ / hoàn quỹ theo tổng kết

- Ghi các loại **DEDUCT** / **REFUND** trong nghiệp vụ kỳ; khi settlement hoàn tất, làm sạch sổ liên quan kỳ để tránh double-count.

---

## 10. Nợ ước tính trên tổng quan / dashboard

- Công thức kiểu: **đã trả + quỹ − phần chia** trên các khoản **chung** chưa tổng kết (chi tiết trong service `unsettledSharedNetBalance`).
- **Chỉ** tính cho user **là thành viên** (không tính cho `adminViewer`).

---

## 11. Lịch sử: Group activity và audit chi

- **GroupActivityLog:** mọi hành động nhóm (mời, join, tạo chi, xóa chi, tổng kết, quỹ, …) có **summary** tiếng Việt / có cấu trúc metadata.
- **AuditLog:** sự kiện nhạy cảm hơn (chi: create/update/soft delete/restore) với JSON `before`/`after` và IP nếu có.
- **ADMIN** có thể có quyền **xóa toàn bộ log nhóm** (chỉ bảng log — không đụng chi tiêu thực).

---

## 12. Thông báo (Notification)

Các **loại** đã định nghĩa trong schema (đại diện):

| Loại | Ngữ cảnh nghiệp vụ |
|------|-------------------|
| SETTLEMENT_CREATED | Đợt tổng kết mới. |
| PAYMENT_REQUEST / CONFIRMED / ACCEPTED / REJECTED | Vòng đời chứng từ tổng kết (và có thể mirror cho các luồng tương tự). |
| STANDALONE_REQUESTED | Luồng chi riêng cần xử lý. |
| FUND_CONTRIBUTED / FUND_LOW_BALANCE | Nộp quỹ / quỹ thấp. |
| MEMBER_JOINED / MEMBER_LEFT | Thành viên vào/ra. |
| EXPENSE_ADDED | Chi mới (nếu phát). |
| **EXPENSE_DELETED** / **EXPENSE_RESTORED** | Xóa mềm / khôi phục chi. |
| GROUP_INVITE | Lời mời nhóm. |
| DEBT_OVERDUE | Nhắc nợ theo cấu hình nhóm / job. |
| SYSTEM_ANNOUNCEMENT | Phát sóng từ ADMIN. |

**Realtime:** Socket (theo cấu hình dự án) có thể đẩy cập nhật nhóm/thông báo.

---

## 13. Tệp đính kèm và lưu trữ

- Upload qua **presigned URL** (MinIO / S3 tương thích): client PUT trực tiếp object storage.
- Ảnh **private** (avatar, chứng từ): URL xem qua **ký tạm** (signed GET) theo user xem.

---

## 14. Góp ý và cấu hình hệ thống

- **Feedback:** USER gửi PRAISE/ISSUE; ADMIN đổi trạng thái NEW → IN_PROGRESS → RESOLVED / ARCHIVED.
- **SystemConfig:** ví dụ thời gian chờ phiên (idle timeout phút) — ảnh hưởng bảo mật phiên.

---

## 15. Quản trị viên (ADMIN)

- CRUD user (tạo, khóa, reset password, đổi role).
- Xem / thao tác nhóm ở mức hệ thống.
- **Broadcast** → tạo hàng loạt `SYSTEM_ANNOUNCEMENT`.
- Duyệt quỹ / xem nhóm trong gate đặc biệt (theo `resolveGroupReadAccess` cho ADMIN).

---

## 16. Bảng tra cứu nhanh: chức năng × vai trò

| Chức năng | MEMBER | VICE_LEADER | LEADER | ADMIN (ngoài nhóm) |
|-----------|--------|-------------|--------|---------------------|
| Xem chi / tạo chi / sửa (đủ điều kiện) | Có | Có | Có | Chỉ xem nếu gate cho phép |
| Xóa mềm / khôi phục chi (trong hạn & trạng thái) | Có | Có | Có | Theo gate |
| Duyệt nộp quỹ | Không | Có | Có | Có (theo API) |
| Tạo / đóng tổng kết | Không | Không | Có | — |
| Cài đặt nhóm (UI) | Không | Không | Có | — |
| Duyệt join request | Không | Có | Có | — |
| Quản lý user hệ thống | Không | Không | Không | Có |

---

**Ghi chú triển khai:** Quyền chi tiết luôn lấy **mã nguồn API** (`apps/api/src/routes/*.ts`, `group-gate`, middleware) làm chuẩn cuối cùng; bảng trên mô tả đúng thiết kế hiện tại của dự án. Khi thêm vai trò hoặc siết quyền, cập nhật đồng thời file này và hướng dẫn người dùng.
