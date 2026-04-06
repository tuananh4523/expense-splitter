# Đề xuất chức năng mới cho Expense Splitter

Dựa trên task gốc (phân tích dự án), đây là **danh sách tính năng bổ sung** phân nhóm theo ưu tiên. Mỗi chức năng có **mô tả**, **lợi ích**, **độ khó triển khai** (thấp/trung bình/cao), **ước tính effort**.

## 🔥 Nhóm 1: Nên có ngay (Ưu tiên cao - Core business)
| Chức năng | Mô tả | Lợi ích | Độ khó | Effort |
|-----------|--------|---------|--------|--------|
| **Nhắc nợ tự động** | Cron job hàng ngày/tuần gửi notify cho khoản nợ quá X ngày (config per group). Hiển thị overdue/red badges. | Giảm nợ tồn đọng, tăng tốc hoàn tất settlement. | Thấp | 1-2 ngày (Prisma cron + NotificationType.DEBT_OVERDUE) |
| **Audit log chi tiết** | Mỗi sửa/xóa expense lưu before/after JSON + who/when. Xem lịch sử "Ai sửa gì?". | Tránh tranh cãi "Sao số tiền thay đổi?", minh bạch. | Thấp | 0.5 ngày (extend AuditLog.before/after) |
| **Hoàn tác (Undo)** | Nút "Undo" 5p sau tạo/sửa/xóa (store recent actions per user). | Tránh sai sót "Vô tình xóa". | Trung bình | 1 ngày (new table UndoAction + button) |
| **Tối ưu giao dịch (Debt simplification)** | Algorithm giảm số chuyển khoản (A nợ B 100, B nợ C 50 → A nợ C 50). Hiện preview "Chỉ cần 3 chuyển thay vì 6". | Giảm phí STK, nhanh hoàn tất. | Trung bình | 1-2 ngày (extend settlement-compute.ts) |
| **Deadline nợ** | Set hạn chót per settlement/payment (overdue badge, auto-remind). | Tăng tốc độ thu nợ. | Thấp | 0.5 ngày (add PaymentRecord.deadline + cron) |

## 🚀 Nhóm 2: UX nâng cao
| Chức năng | Mô tả | Lợi ích | Độ khó | Effort |
|-----------|--------|---------|--------|--------|
| **Scan hóa đơn OCR** | Upload ảnh → AI đọc tiền/ngày/tên/số người (Google Vision/Tesseract). Pre-fill form. | Tiết kiệm nhập tay, chính xác. | Cao | 3-5 ngày (integrate OCR API) |
| **Gợi ý thông minh** | Auto danh mục (ăn → "Ăn uống"), gợi splits từ lịch sử. | Nhanh nhập chi. | Trung bình | 2 ngày (ML lite hoặc rule-based) |
| **Ví điện tử** | Link Momo/ZaloPay QR → 1-click pay + confirm. | Thuận tiện VN. | Cao | 5+ ngày (API payment gateway) |
| **Báo cáo nâng cao** | Filter theo user/cat/time, charts pie/bar. | Phân tích thói quen chi. | Trung bình | 2 ngày (extend dashboard-charts) |
| **Xuất Excel/PDF** | Export settlement/expenses (Google Sheets/ pdf-lib). | Share ngoài app. | Thấp | 1 ngày (xlsx/json2excel) |

## 🏗️ Nhóm 3: Scale hệ thống
| Chức năng | Mô tả | Lợi ích | Độ khó | Effort |
|-----------|--------|---------|--------|--------|
| **Phân quyền chi tiết** | Role custom: VIEW_ONLY, ADD_ONLY, NO_EDIT. Per group. | Linh hoạt lớn nhóm. | Trung bình | 2 ngày (extend GroupRole enum + gates) |
| **Đa tiền tệ** | Support USD/EUR + auto FX rate (free API). | Du lịch quốc tế. | Trung bình | 2 ngày (Currency enum + converter) |
| **Chi định kỳ nâng cao** | Auto tạo theo template (cơm tuần, điện tháng) + adjust amount. | Tiết kiệm lặp. | Thấp | 1 ngày (extend RecurringExpense) |
| **Snapshot dữ liệu** | Backup settlement state trước compute (recover nếu sai). | An toàn dữ liệu. | Thấp | 0.5 ngày (JSON field) |
| **API/Webhook** | Public REST + event webhook (new expense...). | Tích hợp bot/ERP. | Cao | 3 ngày (OpenAPI + Stripe-like webhooks) |

## 💡 Nhóm 4: Engagement
| Chức năng | Mô tả | Lợi ích | Độ khó | Effort |
|-----------|--------|---------|--------|--------|
| **Gamification** | Badge "Trả nhanh nhất", "Hay quên nợ 😅", streak. Leaderboard nhóm. | Fun, cạnh tranh thân thiện. | Trung bình | 2 ngày (UserBadge + points system) |
| **Chat nhóm** | Comment realtime + @user trong expense/group. | Thảo luận trực tiếp. | Trung bình | 2 ngày (extend Socket.io + Message model) |
| **Timeline** | Feed "A thêm chi 200k", "B duyệt nợ" (paginated). | Theo dõi hoạt động. | Thấp | 1 ngày (use GroupActivityLog) |
| **Sandbox** | Test group riêng (data không mix production). | Onboard user mới. | Thấp | 0.5 ngày (flag isSandbox) |

## 🎯 Roadmap triển khai đề xuất (3 tháng)
```
Tháng 1: Nhóm 1 (Core)
- Debt simplification + auto reminder (week 1-2)
- Audit + undo (week 3-4)

Tháng 2: Nhóm 2 (UX)
- Báo cáo/export (week 1)
- OCR scan (week 2-3)
- Gợi ý thông minh (week 4)

Tháng 3: Nhóm 3-4
- Gamification + chat (Polish & launch)
```

**Tổng effort ước tính**: 25-35 ngày (1 dev full-time).

**Bắt đầu từ đâu?** Debt simplification (impact cao, dễ nhất).
