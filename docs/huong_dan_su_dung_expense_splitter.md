# Hướng dẫn sử dụng Expense Splitter (chia chi tiêu nhóm)

Tài liệu dành cho **người dùng cuối**: đăng nhập, tham gia nhóm, ghi chi, quỹ, tổng kết, thông báo và các mẹo vận hành. Các bước được sắp theo thứ tự thường dùng khi bắt đầu một nhóm mới.

---

## Mục lục

1. [Khái quan giao diện](#1-khái-quan-giao-diện)
2. [Đăng ký, đăng nhập và tài khoản](#2-đăng-ký-đăng-nhập-và-tài-khoản)
3. [Dashboard cá nhân](#3-dashboard-cá-nhân)
4. [Nhóm: tạo, tham gia, danh sách](#4-nhóm-tạo-tham-gia-danh-sách)
5. [Bên trong một nhóm — menu bên trái](#5-bên-trong-một-nhóm--menu-bên-trái)
6. [Tổng quan nhóm](#6-tổng-quan-nhóm)
7. [Chi tiêu](#7-chi-tiêu)
8. [Thanh toán chi riêng](#8-thanh-toán-chi-riêng)
9. [Quỹ nhóm](#9-quỹ-nhóm)
10. [Tổng kết (chia tiền theo kỳ)](#10-tổng-kết-chia-tiền-theo-kỳ)
11. [Lịch sử hoạt động](#11-lịch-sử-hoạt-động)
12. [Cài đặt nhóm (trưởng nhóm)](#12-cài-đặt-nhóm-trưởng-nhóm)
13. [Thông báo](#13-thông-báo)
14. [Góp ý / phản hồi](#14-góp-ý--phản-hồi)
15. [Quản trị hệ thống (ADMIN)](#15-quản-trị-hệ-thống-admin)
16. [Câu hỏi thường gặp](#16-câu-hỏi-thường-gặp)

---

## 1. Khái quan giao diện

- **Thanh bên (sidebar)**: Dashboard, nhóm của bạn, tài khoản; khi đang mở một nhóm sẽ thấy thêm các mục con: Tổng quan, Chi tiêu, Thành viên, Quỹ nhóm, Tổng kết, Lịch sử, và **Cài đặt** (chỉ khi bạn là **Trưởng nhóm**).
- **Thanh trên**: thông báo (chuông), menu tài khoản (đổi mật khẩu, đăng xuất).
- **Nội dung chính**: thay đổi theo trang bạn chọn.

---

## 2. Đăng ký, đăng nhập và tài khoản

### 2.1. Đăng ký (lần đầu)

1. Mở trang **Đăng nhập**, chọn **Đăng ký** (hoặc đường dẫn đăng ký tương ứng).
2. Điền **email**, **tên hiển thị**, **mật khẩu** theo yêu cầu form.
3. Gửi form → tạo tài khoản → đăng nhập để vào ứng dụng.

### 2.2. Đăng nhập

1. Nhập **email** và **mật khẩu**.
2. **Đăng nhập** → hệ thống chuyển về Dashboard hoặc trang bạn đang mở trước đó (tùy cấu hình).

### 2.3. Tài khoản bị khóa

- Nếu tài khoản bị vô hiệu hóa, hệ thống có thể đăng xuất và yêu cầu liên hệ quản trị.

### 2.4. Đổi mật khẩu

1. Vào menu **Tài khoản** / biểu tượng người dùng (tùy giao diện).
2. Chọn đổi mật khẩu, nhập mật khẩu hiện tại và mật khẩu mới.
3. Nếu quản trị vừa **reset mật khẩu** cho bạn, lần đăng nhập sau có thể bắt buộc đổi mật khẩu — làm theo hộp thoại hướng dẫn.

### 2.5. Tài khoản demo (môi trường thử)

- Có thể dùng tài khoản seed do dự án cung cấp (ví dụ trong README hoặc seed) để xem nhanh dữ liệu mẫu. **Không** dùng mật khẩu yếu trên môi trường thật.

---

## 3. Dashboard cá nhân

Trang **Dashboard** tổng hợp:

| Thành phần | Ý nghĩa |
|------------|---------|
| **Nhóm tham gia** | Số nhóm bạn đang là thành viên; bấm để vào danh sách nhóm. |
| **Đang nợ (ước tính)** | Tổng hợp theo công thức “đã trả + quỹ − phần chia” trên các khoản **chung** (âm = đang nợ). |
| **Được nợ (ước tính)** | Cùng công thức, dương = được nhận lại. |
| **Tổng kết đang chờ** | Số đợt tổng kết cần xử lý (chứng từ / duyệt). |
| **Biểu đồ** | Chi tiêu cá nhân theo khoảng thời gian (thường vài chục ngày gần nhất). |

**Lưu ý:** Số “nợ / được nợ” là **ước tính** để bạn nắm nhanh; chi tiết theo từng nhóm nằm ở **Tổng quan nhóm** và **Tổng kết**.

---

## 4. Nhóm: tạo, tham gia, danh sách

### 4.1. Tạo nhóm mới

1. Vào **Nhóm của tôi** (hoặc tương đương) → **Tạo nhóm**.
2. Điền **tên nhóm**, **mô tả** (khuyến nghị), có thể chọn **biểu tượng / màu**.
3. **Duyệt thành viên**: bật nếu chỉ muốn người vào nhóm sau khi trưởng/phó duyệt (xem thêm mục tham gia bằng mã).
4. Lưu → bạn trở thành **Trưởng nhóm**; nhóm có **mã mời** và thường đã có **quỹ** (số dư 0).

### 4.2. Tham gia nhóm bằng mã mời

1. Lấy **mã mời** (chuỗi dài) từ trưởng nhóm hoặc từ kênh chat nhóm.
2. Vào **Tham gia nhóm** → dán mã → xác nhận.
3. **Nếu nhóm không bật duyệt**: bạn vào thành viên ngay.
4. **Nếu nhóm bật duyệt**: tạo **yêu cầu tham gia** ở trạng thái chờ; khi trưởng/phó **duyệt** bạn mới vào nhóm.

### 4.3. Lời mời qua email

1. Trưởng/phó gửi lời mời tới email của bạn.
2. Bạn nhận **thông báo** → mở → **Chấp nhận** (hoặc từ chối tùy giao diện).
3. Sau khi chấp nhận, nhóm xuất hiện trong danh sách nhóm của bạn.

### 4.4. Danh sách nhóm

- Mỗi **thẻ nhóm** hiển thị tên, số thành viên, vai trò của bạn, dòng **Quỹ** (nếu có).
- Khi **số dư quỹ thấp hơn hoặc bằng ngưỡng cảnh báo** đã cài (và ngưỡng > 0), số quỹ trên thẻ có thể hiển thị **màu đỏ cảnh báo**.

---

## 5. Bên trong một nhóm — menu bên trái

Khi chọn một nhóm, sidebar hiển thị:

| Mục | Ai dùng nhiều | Ghi chú |
|-----|----------------|--------|
| **Tổng quan** | Mọi người | Số liệu nhanh, lối tắt “chi riêng chưa xong”, “tổng kết chờ thanh toán”. |
| **Chi tiêu** | Mọi người | Danh sách, thêm/sửa/xóa mềm, bộ lọc. |
| **Thành viên** | Mọi người | Xem danh sách; trưởng/phó mời, đổi vai trò, vô hiệu hóa. |
| **Quỹ nhóm** | Mọi người (nộp); trưởng/phó duyệt | Cần quỹ đã được bật. |
| **Tổng kết** | Trưởng tạo đợt; mọi người thanh toán theo vai trò | Khóa chi trong kỳ khi đợt đã tạo. |
| **Lịch sử** | Mọi người | Nhật ký hoạt động (ai làm gì). |
| **Cài đặt** | **Chỉ trưởng nhóm** | Mã mời, tên/mô tả, nhắc nợ, v.v. |

---

## 6. Tổng quan nhóm

1. Chọn nhóm → **Tổng quan**.
2. Xem **banner nhóm** (ảnh/icon), mô tả, tag vai trò và số thành viên.
3. Các **ô thống kê**:
   - **Thành viên** / **Chi tiêu tháng này** / **Quỹ nhóm** / **Đang nợ – Được nợ (ước tính)** / **Tổng kết đang chờ**.
4. **Quỹ nhóm**: nếu số dư **≤ ngưỡng cảnh báo** (và ngưỡng được đặt > 0), số tiền và viền thẻ có thể chuyển **sang tông đỏ cảnh báo**; dòng phụ giải thích trạng thái.
5. Hai **nút lớn** phía dưới:
   - **Thanh toán riêng chưa xong** → mở trang Chi tiêu với bộ lọc chi riêng chưa hoàn tất.
   - **Tổng kết đang chờ thanh toán** → mở trang Tổng kết với bộ lọc đang chờ.

---

## 7. Chi tiêu

### 7.1. Xem danh sách

1. Vào **Chi tiêu**.
2. Dùng **bộ lọc** (ngày, danh mục, trạng thái, phạm vi):
   - **Tất cả chi tiêu** / **Chi riêng — chưa xong thanh toán** / **Đã xóa (khôi phục trong 7 ngày)**.
3. Bảng hiển thị: tiêu đề, số tiền, ngày, danh mục, người trả, trạng thái, thao tác.

### 7.2. Thêm chi tiêu

1. Bấm **Thêm chi tiêu** (nút chính trên trang).
2. Làm theo **các bước form** (thường gồm: thông tin chung → cách chia → xác nhận):
   - **Tiêu đề**, **số tiền**, **ngày**, **danh mục** (nếu có).
   - **Ai trả**: mặc định là bạn; có thể chọn thành viên khác nếu được phép.
   - **Cách chia**:
     - **Chia đều**: hệ thống chia đều cho các thành viên đang tham gia chia (có thể loại trừ người không tham gia phần đó).
     - **Số tiền cụ thể**: nhập đúng tổng bằng tổng bill.
     - **Phần trăm**: tổng % các phần không loại trừ phải đạt **100%**.
   - **Ảnh chứng từ / tag / mô tả** (nếu có).
   - **Chi riêng**: bật khi khoản chỉ liên quan một phần nhỏ nhóm; hệ thống tạo luồng **thanh toán riêng** (xem mục 8).
   - **Lặp lại (chu kỳ)**: nếu form có trường lặp lại, có thể đặt số ngày để hệ thống tạo bản ghi theo chu kỳ (tùy cấu hình dự án).
3. **Lưu** → chi xuất hiện trong danh sách; thành viên liên quan có thể nhận **thông báo**.

### 7.3. Xem chi tiết, bình luận, lịch sử (audit) của một chi

1. Trên dòng chi, bấm **xem** (biểu tượng mắt) → mở **ngăn kéo chi tiết**.
2. Các **tab**: Chi tiết, Bình luận, **Lịch sử** (các thao tác / audit gắn với chi).
3. Trong tab **Lịch sử**, có thể có lối tắt tới **danh sách chi đã xóa (khôi phục trong 7 ngày)** nếu bạn cần khôi phục khoản đã xóa mềm.

### 7.4. Sửa chi

1. Chỉnh sửa qua nút **sửa** (khi trạng thái cho phép: thường **chưa tổng kết**, chi riêng **chưa hoàn tất** thanh toán).
2. Lưu thay đổi → danh sách và chi tiết cập nhật.

### 7.5. Xóa chi (xóa mềm) và khôi phục

1. **Xóa**: xác nhận trong hộp thoại → chi **ẩn** khỏi danh sách thường, được coi là **đã xóa mềm**.
2. **Thông báo**: các thành viên liên quan (ví dụ người trả, người trong phần chia, trưởng nhóm) có thể nhận thông báo, nội dung nhắc **có thể khôi phục trong 7 ngày**.
3. **Khôi phục**:
   - Vào bộ lọc **Đã xóa (khôi phục trong 7 ngày)** **hoặc** dùng lối tắt từ tab Lịch sử trong chi tiết (nếu có).
   - Trên dòng chi đã xóa, bấm **Khôi phục** và xác nhận (chỉ trong hạn **7 ngày** kể từ lúc xóa; sau hạn nút khôi phục không còn hiệu lực).
4. Chi **đã tổng kết** hoặc **chi riêng đã hoàn tất** thường **không** được xóa theo luật nghiệp vụ — nếu giao diện chặn, đó là đúng thiết kế.

### 7.6. Chi riêng — mở màn hình thanh toán từ danh sách

- Với chi có nhãn **Riêng**, trên dòng chi có nút **ví** → mở **cửa sổ thanh toán riêng** (xem mục 8).

---

## 8. Thanh toán chi riêng

Áp dụng khi chi được đánh dấu **chi riêng**; mỗi người trong phần chia có thể có yêu cầu chuyển tiền cho **người trả**.

### 8.1. Luồng điển hình

1. **Người trả tiền** (payer theo bản ghi): mở cửa sổ thanh toán → đính **ảnh chứng từ** chuyển khoản → **Xác nhận đã chuyển**.
2. **Người nhận** (hoặc trưởng nhóm trong một số bước duyệt): xem chứng từ → **Chấp nhận** hoặc **Từ chối**.
3. Khi **tất cả** các dòng liên quan đạt trạng thái đồng ý → chi chuyển sang trạng thái **chi riêng xong** (theo nghiệp vụ hệ thống).

### 8.2. Nhắc nhở / yêu cầu xem lại

- Trong cửa sổ thanh toán có thể có thao tác **nhắc** người đối tác hoặc **yêu cầu trưởng nhóm xem lại** (tùy quyền và trạng thái bản ghi).

---

## 9. Quỹ nhóm

### 9.1. Bật quỹ (thường do trưởng nhóm)

1. Trưởng nhóm vào **Cài đặt** hoặc luồng **Quỹ nhóm** (tùy phiên bản giao diện) để **bật / khởi tạo quỹ** nếu nhóm chưa có.

### 9.2. Nộp quỹ (thành viên)

1. Vào **Quỹ nhóm**.
2. **Nộp quỹ** → nhập số tiền, ghi chú (nếu có), **ảnh chứng từ** bắt buộc.
3. Gửi → giao dịch ở trạng thái **chờ duyệt** cho đến khi trưởng/phó **duyệt** hoặc **từ chối**.

### 9.3. Duyệt nộp quỹ (trưởng / phó)

1. Vào **Quỹ nhóm** → danh sách giao dịch chờ.
2. Xem ảnh → **Duyệt** hoặc **Từ chối** (có thể kèm ghi chú).

### 9.4. Ngưỡng cảnh báo quỹ thấp

1. Trưởng nhóm (hoặc màn hình cài đặt quỹ) đặt **ngưỡng cảnh báo** (ví dụ 500.000 đ).
2. Khi **số dư ≤ ngưỡng** (và ngưỡng > 0), trên **Tổng quan nhóm** và **trang Quỹ** số dư có thể hiển thị **màu đỏ cảnh báo**; có thể có thông báo / cảnh báo loại quỹ thấp.

### 9.5. Quan hệ với tổng kết

- Khi một **đợt tổng kết** hoàn tất, hệ thống xử lý các bút toán quỹ liên quan kỳ đó theo quy tắc nghiệp vụ (bạn không cần thao tác thủ công từng dòng).

---

## 10. Tổng kết (chia tiền theo kỳ)

### 10.1. Chuẩn bị (trưởng nhóm)

1. Vào **Tổng kết**.
2. Chọn **Xem trước** / **Tạo mới** (tùy nhãn nút): chọn **khoảng thời gian** (bắt đầu – kết thúc).
3. Hệ thống tính:
   - Các khoản **chi chung** trong kỳ (không tính chi riêng theo luật tổng kết).
   - **Số dư / luồng** giữa các thành viên (ai cần chuyển cho ai).
4. Chọn **người nhận quỹ** (người tập trung tiền về một tài khoản chung nếu có gợi ý).
5. **Tạo đợt tổng kết** → các chi trong kỳ chuyển sang **đã gắn đợt / khóa** tùy trạng thái; mọi người nhận **thông báo**.

### 10.2. Thanh toán trong đợt

1. Mở **chi tiết đợt tổng kết** (từ danh sách đợt).
2. Với từng **dòng chuyển tiền** mà bạn là **người trả**:
   - Đính **ảnh chứng từ** → **Xác nhận đã chuyển**.
3. **Người nhận** (và đôi khi trưởng nhóm): **duyệt** hoặc **từ chối** chứng từ.
4. Khi toàn bộ luồng hợp lệ → đợt có thể **hoàn thành**; chi trong kỳ chuyển trạng thái **đã tổng kết**.

### 10.3. Nhắc thanh toán (trưởng nhóm)

- Trên danh sách hoặc chi tiết đợt, trưởng nhóm có thể **gửi nhắc** cho những người chưa hoàn tất bước chứng từ / thanh toán (nếu giao diện cung cấp nút nhắc).

---

## 11. Lịch sử hoạt động

1. Vào **Lịch sử** trong nhóm.
2. Dùng ô tìm theo **mô tả**, **mã hành động** (nếu bạn biết mã kỹ thuật), **loại đích** (chi tiêu, thành viên, …), **khoảng ngày**, tùy chọn **ẩn log liên quan chi riêng**.
3. **Xóa bộ lọc** để về mặc định.
4. **Quản trị hệ thống** có thể có thêm công cụ xóa log nhóm (chỉ ảnh hưởng nhật ký, không xóa chi tiêu).

---

## 12. Cài đặt nhóm (trưởng nhóm)

1. Chỉ **Trưởng nhóm** thấy mục **Cài đặt**.
2. Có thể chỉnh:
   - **Tên / mô tả / ảnh đại diện / màu / icon** nhóm.
   - **Mã mời**: bật/tắt, tạo mã mới, hạn mã (nếu có).
   - **Duyệt thành viên** khi tham gia.
   - **Nhắc nợ** (bật/tắt, số ngày) — gửi thông báo khi có khoản chi chưa thanh toán quá hạn cấu hình (theo thiết lập nhóm).

---

## 13. Thông báo

1. Bấm **chuông** trên thanh header.
2. Danh sách hiển thị: tổng kết, quỹ, mời nhóm, chi bị xóa / được khôi phục, nhắc nợ, thông báo hệ thống, v.v.
3. Bấm vào một thông báo → thường **chuyển tới đúng trang** liên quan (ví dụ chi tiêu nhóm, đợt tổng kết).
4. **Đánh dấu đã đọc** theo từng mục hoặc hàng loạt (nếu có).

---

## 14. Góp ý / phản hồi

- Trang **Góp ý** (hoặc tên tương đương trong menu hệ thống / tài khoản): gửi **khen** hoặc **báo lỗi / đề xuất**.
- Quản trị xử lý và cập nhật trạng thái; bạn theo dõi trong danh sách của mình.

---

## 15. Quản trị hệ thống (ADMIN)

Chỉ tài khoản có vai trò **ADMIN** thấy khu vực quản trị (tên menu có thể là **Bảng điều khiển**, **Người dùng**, **Nhóm (hệ thống)**, **Phát sóng**, **Góp ý**, **Cài đặt hệ thống**, …). Chức năng tiêu biểu:

- **Người dùng**: tạo tài khoản, khóa/mở, reset mật khẩu, đổi vai trò.
- **Nhóm**: xem danh sách nhóm toàn hệ thống, trạng thái, số dư quỹ (nếu hiển thị).
- **Phát sóng**: gửi thông báo tới nhiều người dùng.
- **Góp ý**: xử lý ticket.
- **Duyệt quỹ / xem nhóm** trong một số luồng đặc biệt (theo quyền admin trên API).

Người dùng **USER** không cần dùng phần này trong nhật ký thao tác hằng ngày.

---

## 16. Câu hỏi thường gặp

| Câu hỏi | Trả lời ngắn |
|---------|----------------|
| **Không lưu được chi, báo lỗi chia tiền?** | Kiểm tra tổng phần **số tiền** hoặc **phần trăm** khớp tổng bill; đảm bảo ít nhất một người tham gia chia (với chia đều). |
| **Hết mã mời hoặc mã lộ?** | Trưởng nhóm vào **Cài đặt** → tạo **mã mới** / đặt hạn mã. |
| **Sửa chi bị chặn?** | Chi có thể đã **tổng kết** hoặc **chi riêng đã xong** — không cho sửa để bảo toàn sổ sách. |
| **Xóa nhầm chi?** | Trong **7 ngày**, vào bộ lọc **Đã xóa** và **Khôi phục**; đọc thông báo hệ thống gửi kèm. |
| **Quỹ không tăng sau khi chuyển khoản?** | Giao dịch nộp quỹ cần **duyệt**; kiểm tra trạng thái PENDING / REJECTED trên trang Quỹ. |
| **Ai được duyệt vào nhóm khi bật “duyệt thành viên”?** | **Trưởng nhóm** và **Phó nhóm** (theo quyền API hiện tại). |

---

**Phiên bản tài liệu:** phản ánh các chức năng chính của mã nguồn dự án (chi mềm 7 ngày, ngưỡng quỹ, bộ lọc chi đã xóa, v.v.). Nếu giao diện đổi tên nút, hãy đối chiếu với nhãn trên màn hình thực tế.
