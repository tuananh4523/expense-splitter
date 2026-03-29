# Tiêu chuẩn thiết kế — Chia Chi Tiêu (web)

Tài liệu gốc để **đồng bộ UI** giữa người và công cụ AI. Khi chỉnh giao diện, ưu tiên **khớp token/CSS hiện có** thay vì thêm màu/spacing tùy ý.

---

## Nguồn sự thật (single source)

| Thành phần | Đường dẫn |
|------------|-----------|
| Biến CSS (màu, spacing, shadow, radius) | `apps/web/src/styles/tokens.css` |
| Shell + body + FAB | `apps/web/src/styles/shell.css` |
| Layout app, sidebar, header, form/table, auth, upload… | `apps/web/src/styles/globals.css` |
| Theme Ant Design (token + component) | `apps/web/src/pages/_app.tsx` |
| Utility Tailwind | `apps/web/tailwind.config.ts` (`brand`, `page`, `wp.*`, `boxShadow`) |

Import CSS: `shell.css` → `globals.css` (trong `_app.tsx`). `globals.css` đã `@import` `tokens.css`.

---

## Đa theme (roadmap — chưa bắt buộc)

Ứng dụng hiện **một** bảng màu WordPress admin trong `tokens.css` (`:root`). Tài liệu ngoài (ví dụ *theme-system-prompt*: 16 palette kiểu WP Admin) có thể tham khảo theo hướng dưới — **không** copy nguyên mã nguồn dùng stack khác.

### Khớp với base hiện tại

| Gợi ý từ prompt ngoài | Cách áp trong repo này |
|------------------------|-------------------------|
| Biến `--color-primary`, `--color-sidebar-*` | Map sang token đã có: `--color-brand`, `--wp-*`, semantic trong `tokens.css` + class trong `globals.css` / `shell.css` |
| File `src/styles/themes.css` | Đặt tại `apps/web/src/styles/themes.css`, `@import` sau `tokens.css` để các block `[data-theme="…"]` **ghi đè** biến cùng tên |
| `useTheme` + `useUser` giả định | Dùng session / `useMe` (hoặc hook profile thực tế) + `PATCH` API nội bộ đã có pattern tương tự |
| Nút theme cạnh bell | `Header.tsx` / layout: **Ant Design** `Dropdown` hoặc `Popover`, icon **@ant-design/icons** hoặc **Iconify** (đã dùng trong app) — không bắt buộc `lucide-react` |
| Lưu DB | **Prisma** trên model `User` (hoặc bảng preferences): field kiểu string enum theme id; tránh paste SQL thô trừ khi migration có sẵn trong `packages/database` |

### Nguyên tắc nếu triển khai nhiều theme

1. **Một tập tên biến**: mọi theme chỉ khác **giá trị** của cùng `--color-brand`, `--color-text`, `--color-bg-page`, v.v. — component và Tailwind `border-[--color-border]` không đổi.
2. **Bật theme**: `document.documentElement.setAttribute('data-theme', id)` (hoặc `dataset.theme`) khớp selector CSS `[data-theme="ocean"]` …
3. **Tránh nháy màu**: áp theme từ preference user càng sớm càng tốt (inline script nhỏ trong `_document` hoặc đọc cookie/session trước paint — tùy cách auth).
4. **Ant Design**: sau khi đổi CSS variables, đồng bộ `token` / `components` trong `_app.tsx` nếu màu hard-code ở đó không còn khớp.
5. **Contrast**: theme sidebar/header sáng (ví dụ *seashore* trong prompt gốc) cần kiểm tra chữ `#555` trên nền kem — giữ nguyên quy tắc độ tương phản WCAG.

### Checklist tối thiểu (khi làm thật)

- [ ] `themes.css` chỉ chứa override `[data-theme="…"]` cho biến đã định nghĩa trong `tokens.css`
- [ ] Danh sách id theme là union TypeScript + validate API (không string tự do)
- [ ] UI chọn theme: grid swatch trong **Profile** + shortcut header (tùy UX)
- [ ] Không thêm gradient / glow trái với mục **Không nên** bên dưới

---

## Bảng màu

### Năm màu nền tảng

| Tên | Hex | Token CSS | Tailwind | Dùng cho |
|-----|-----|-----------|----------|----------|
| Charcoal | `#1d2327` | `--color-text` | `text-wp-charcoal` | Chữ chính, nền sidebar/drawer |
| Slate | `#2c3338` | `--color-text-secondary` | `text-wp-slate` | Chữ phụ, label form |
| Muted | `#646970` | `--color-text-muted` | — | Chữ hint, placeholder |
| Hint | `#8c8f94` | `--color-text-hint` | — | Chevron, timestamp mờ |
| Blue (brand) | `#0073aa` | `--color-brand` | `text-brand`, `bg-brand` | Primary button, link, logo mark, active |
| Blue đậm | `#005a87` | `--color-brand-text` | `text-brand-text` | Chữ/link nhấn trên nền sáng |
| Nền app | `#f0f0f1` | `--color-bg-page` | `bg-page` | Nền trang, vùng content |
| Surface | `#ffffff` | `--color-surface` | `bg-white` | Card, modal, khối nổi |
| Orange | `#d54e21` | `--color-accent`, `--color-warning` | — | Cảnh báo, accent ấm |

### Viền

| Token | Hex | Khi dùng |
|-------|-----|----------|
| `--color-border` | `#c3c4c7` | Viền mặc định (card, input, table) |
| `--color-border-strong` | `#a7aaad` | Viền nhấn mạnh, hover |
| `--color-border-light` | `#dcdcde` | Divider nhẹ trong card |

### Semantic (trạng thái)

| Trạng thái | Màu chính | Nền nhạt (soft) |
|------------|-----------|-----------------|
| Success | `#00a32a` | `#edfaef` |
| Danger | `#d63638` | `#fcf0f1` |
| Warning | `#d54e21` | `#fcf9e8` |
| Info | `#0073aa` | `#e5f4fa` |

### Quy tắc màu

- **Không** dùng lại palette cũ (`indigo #4F46E5`, stone page `#f5f4f2`…) cho màn mới.
- **Ưu tiên** `var(--color-…)` trong CSS; trong TSX dùng class Tailwind `text-brand`, `bg-brand-soft`, `bg-page`, `text-wp-charcoal`, v.v.
- Hard-code hex chỉ khi không có token tương đương (ảnh preview, illustration đặc thù).

---

## Khoảng cách (spacing)

Chỉ dùng **bậc cố định** (px): `4 → 8 → 12 → 16 → 20 → 24 → 32 → 40 → 48`

| Token | Giá trị | Tailwind tương đương |
|-------|---------|----------------------|
| `--space-1` | 4px | `p-1`, `gap-1`, `m-1` |
| `--space-2` | 8px | `p-2`, `gap-2`, `m-2` |
| `--space-3` | 12px | `p-3`, `gap-3`, `m-3` |
| `--space-4` | 16px | `p-4`, `gap-4`, `m-4` |
| `--space-5` | 20px | `p-5`, `gap-5`, `m-5` |
| `--space-6` | 24px | `p-6`, `gap-6`, `m-6` |
| `--space-8` | 32px | `p-8`, `gap-8`, `m-8` |
| `--space-10` | 40px | `p-10`, `gap-10`, `m-10` |
| `--space-12` | 48px | `p-12`, `gap-12`, `m-12` |

### Spacing theo context

| Context | Giá trị | Token |
|---------|---------|-------|
| Padding nội dung trang (desktop) | 24px | `--page-padding-x` |
| Padding nội dung trang (mobile) | 16px | `--page-padding-x-sm` |
| Margin dưới tiêu đề trang | 24px | `--page-header-mb` |
| Card lớn (padding body) | 24px | `--card-padding` |
| Card nhỏ | 16px | `--card-padding-sm` |
| Form Item margin-bottom | 20px | `--form-item-mb` |
| Form label margin-bottom | 6px | `--form-label-mb` |
| Giữa các Card xếp dọc (settings) | ≥ 32px | `gap-8` |
| Giữa section trong trang (filter+table) | ≥ 24px | `gap-6` |
| Icon + text trong button/row | 8px | `gap-2` |
| Nút cạnh nhau trong action row | 12px | `gap-3` |

### Spacing cho list trong popup/dropdown

- Gap dọc giữa các item: **tối thiểu 8px, khuyến nghị 12px** (`gap-3`)
- Padding vùng list (lề ngang + dọc): **≥ 12px** — tránh `px-1` / `gap-0`
- Tham chiếu: `NotificationBellDropdown`

---

## Bo góc (radius)

| Token | Giá trị | Tailwind | Dùng cho |
|-------|---------|----------|----------|
| `--radius-sm` | 6px | `rounded-md` | Tag, chip nhỏ, button mặc định |
| `--radius-md` | 10px | `rounded-xl` | Icon tile, input, ô upload |
| `--radius-lg` | 12px | `rounded-2xl` | Card, bảng, modal, khối section |
| — | 20px | — | Auth card/panel (`auth-page__panel`) |
| — | 9999px | `rounded-full` | Avatar, FAB, badge tròn |

---

## Đổ bóng (shadow)

Một lớp, dựa trên `#1d2327` — không dùng glow nhiều màu:

| Token | Giá trị | Khi dùng |
|-------|---------|----------|
| `--shadow-sm` | `0 2px 6px rgba(29, 35, 39, 0.08)` | Card, bảng, header, nút mặc định |
| `--shadow-md` | `0 6px 18px rgba(29, 35, 39, 0.12)` | Hover card, auth panel, modal nổi |

---

## Typography

- **Font chính**: Be Vietnam Pro (`--font-be-vietnam-pro` / `var(--font-primary)`)
- Ant Design: `fontSize` 14px; label form **13px** `font-weight: 500` màu `#2c3338`

### Scale

| Cấp | Size | Weight | Tailwind | Dùng cho |
|-----|------|--------|----------|----------|
| Tiêu đề trang | 22px | 700 | — | `<h1>` header |
| Tiêu đề section | 18px | 700 | `text-lg font-bold` | `app-header-title`, section header |
| Tiêu đề card | 15–20px | 600 | `font-semibold` | Card heading |
| Label form | 13px | 500 | `text-sm font-medium` | `ant-form-item-label` |
| Body | 14px | 400 | `text-sm` | Mô tả, nội dung chính |
| Body lớn | 16px | 400 | `text-base` | Đoạn văn |
| Label nhỏ | 12px | 600 | `text-xs font-semibold` | Badge, section label |
| Tiny | 10px | 700 | — | Section label sidebar |
| Số tài chính | — | — | `font-mono tabular-nums` | Số tiền, số lượng |

---

## Button

### Các variant chuẩn (Ant Design)

```tsx
// Primary — hành động chính
<Button type="primary" htmlType="submit" loading={isPending} block>
  Xác nhận
</Button>

// Default — hành động phụ
<Button>Quay lại</Button>

// Dashed — thêm mới
<Button type="dashed" icon={<PlusOutlined />}>Thêm mục</Button>

// Text — inline action không nổi bật
<Button type="text" icon={<Icon />} />

// Danger
<Button danger>Xoá</Button>
```

### Sizes

| Size | Chiều cao | Khi dùng |
|------|-----------|----------|
| Default | 40px | Phần lớn button trong form, toolbar |
| Large | 48px | CTA chính trong modal, trang auth |
| Small | 32px | Hành động compact trong bảng/tag |

### Quy tắc button

- **CTA chính trong mỗi màn** chỉ có **một** `type="primary"`, còn lại dùng `default` hoặc `text`.
- Nút icon tròn 36×36px: `rounded-full border border-[--color-border] bg-white shadow-sm` (xem `.app-header-bell-btn`).
- Hover icon button: `color: #0073aa`, `background: #f0f0f1`.
- Không thêm gradient vào button.

---

## Card

### Cấu trúc cơ bản

```tsx
<Card className="rounded-2xl border border-[--color-border] shadow-[--shadow-sm]">
  {/* Ant tự render .ant-card-body với padding 24px */}
</Card>
```

### Các loại card

| Loại | Class | Padding | Radius | Shadow |
|------|-------|---------|--------|--------|
| Card chung | Ant `<Card>` | 24px (`--card-padding`) | 12px | `shadow-sm` |
| Card nhỏ | + `className="..."` | 16px (`--card-padding-sm`) | 12px | `shadow-sm` |
| Highlight tile (stat) | `.highlight-tile` | 24px | 12px | `shadow-sm` → hover `shadow-md` |
| Group card | `.group-card` | 16–24px | 12px | — |
| Auth panel | `.auth-page__panel` | 40px | 20px | `shadow-md` |

### Highlight tile (thống kê dashboard)

```tsx
<Card className="highlight-tile highlight-tile--indigo">
  <div className="highlight-tile__inner">
    {/* Icon 48×48, radius-md, nền nhạt */}
    <div className="highlight-tile__icon" />
    <div className="highlight-tile__main">
      <div className="highlight-tile__head">
        <span>{title}</span>
        <ChevronIcon />
      </div>
      <p className="highlight-tile__desc">{description}</p>
      {/* Viền ngang + padding-top ≥ 16px trước số */}
      <div className="highlight-tile__value">{value}</div>
    </div>
  </div>
</Card>
```

**Variants** (viền trái 4px):

| Variant class | Màu accent | Icon bg |
|---------------|------------|---------|
| `--indigo` | `#0073aa` | `#e5f4fa` |
| `--rose` | `#d63638` | `#fcf0f1` |
| `--emerald` | `#00a32a` | `#edfaef` |
| `--amber` | `#d54e21` | `#fcf9e8` |
| `--teal` | `#2271b1` | `#e5f4fa` |
| `--violet` | `#005a87` | `#e5f4fa` |

### Card nhiều bước / wizard

```tsx
<Card>
  <div className="wizard-card-body">
    {/* flex-col, gap: 24px giữa các khối */}
    …nội dung…
  </div>
  <div className="wizard-card-actions">
    {/* border-top + padding-top + margin-top 24px, gap 12px */}
    <Button type="primary">Xác nhận</Button>
    <Button>Quay lại</Button>
  </div>
</Card>
```

Tham chiếu: `settlement/new.tsx`, `join.tsx`.

---

## Modal & Drawer

### Modal chuẩn

```tsx
<Modal
  open={open}
  onCancel={onClose}
  title="Tiêu đề"
  footer={null}
  destroyOnClose
  width={560}          // Hẹp: 560; rộng hơn: 600
>
  {/* Nội dung */}
</Modal>
```

### Drawer (slide từ phải)

```tsx
<Drawer
  title="Tiêu đề"
  placement="right"
  width={560}          // hoặc 600
  onClose={onClose}
  open={open}
  destroyOnClose
>
  {/* Nội dung */}
</Drawer>
```

### Quy tắc modal/drawer

- `destroyOnClose` — luôn bật để unmount state cũ.
- `footer={null}` — tự quản lý footer bên trong nội dung.
- Drawer header: `padding: 16px`, `border-bottom: 1px solid rgba(255,255,255,0.08)`, `background: #1d2327` (`.app-drawer-head`).
- Nội dung form trong modal/drawer: dùng `Form layout="vertical"` + spacing chuẩn.

---

## Form & Input

### Cấu trúc form

```tsx
<Form layout="vertical" onFinish={handleSubmit}>
  <Form.Item label="Nhãn">
    <Controller
      name="fieldName"
      control={control}
      render={({ field }) => (
        <Input size="large" status={error ? 'error' : ''} {...field} />
      )}
    />
    {error && (
      <Typography.Text type="danger" className="mt-1 block text-sm">
        {error.message}
      </Typography.Text>
    )}
  </Form.Item>
</Form>
```

### Sizes input

| Size | Chiều cao | Khi dùng |
|------|-----------|----------|
| Default | 40px | Bộ lọc, form nội dung phụ |
| Large | 48px | Form chính, modal/auth |

### Các loại input chuẩn

```tsx
<Input size="large" placeholder="..." />
<Input.TextArea rows={3} />
<Select allowClear showSearch optionFilterProp="label" className="w-full" />
<DatePicker className="w-full" format="DD/MM/YYYY" />
<InputNumber className="w-full" />
```

### Form label styling (globals.css)

- `font-size: 13px`, `font-weight: 500`, `color: #2c3338`

### Upload

Giới hạn dung lượng ảnh dùng hằng từ `@expense/types`: `MAX_IMAGE_UPLOAD_MB` / `MAX_IMAGE_UPLOAD_BYTES` (xem `FileUpload`, `AvatarUpload`, `FeedbackImageUpload`).

```tsx
import { MAX_IMAGE_UPLOAD_MB } from '@expense/types'

<Upload.Dragger listType="picture-card" showUploadList={{ showRemoveIcon: true }}>
  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
  <p className="ant-upload-text">Kéo thả hoặc click để chọn</p>
  <p className="ant-upload-hint">Tối đa {MAX_IMAGE_UPLOAD_MB}MB</p>
</Upload.Dragger>
```

---

## Layout app

### Sidebar (dark)

- Nền: `#1d2327`; width expanded: 256px; collapsed: 80px.
- Chữ/icon: `#c3c4c7`; hover: `rgba(255,255,255,0.08)` + chữ trắng.
- Item active: `rgba(0, 115, 170, 0.35)` + chữ trắng.
- Logo mark: 38×38px, `border-radius: 10px`, nền `#0073aa`.
- Menu item: `border-radius: 8px`, `margin: 2px 8px`.

### Header

- Nền: `#ffffff`; `border-bottom: 1px solid var(--color-border)`; `box-shadow: var(--shadow-sm)`.
- Chiều cao: `64px`; `padding: 0 20px 0 16px`; `position: sticky; top: 0`.
- Tiêu đề: 18px, weight 700, `color: #1d2327`, `letter-spacing: -0.02em`.
- Icon button header: 36×36px, `rounded-full`, `border`, `shadow-sm`.

### Nền trang

- `body` / content area: `#f0f0f1` (`--color-bg-page`).

### FAB (Floating Action Button)

- 56×56px, `rounded-full`, `background: #0073aa`, `color: #fff`.
- `position: fixed; right: 24px; bottom: 24px; z-index: 200`.
- Hover: `shadow-md`; focus-visible: `outline: 2px solid #72aee6`.

---

## Bảng (Table)

```css
/* globals.css */
.ant-table {
  border-radius: 12px;     /* --radius-lg */
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.ant-table-thead > tr > th {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f0f0f1;
}
```

- Padding ô body: `16px` dọc, `24px` ngang (`--space-4` / `--space-6`).
- Pagination: `margin: 24px 24px 0`.

---

## Navigation / Tabs

```tsx
<Tabs
  items={[
    { key: 'info', label: 'Thông tin', children: <div>...</div> },
    { key: 'history', label: 'Lịch sử', children: <div>...</div> },
  ]}
/>
```

---

## Tag / Badge

```css
/* globals.css */
.ant-tag {
  border-radius: 6px;    /* --radius-sm */
  font-weight: 500;
  font-size: 11px;
  padding: 2px 8px;
  border: none;
}
```

---

## Empty state

```tsx
<Empty className="empty-state" description="Chưa có dữ liệu" />
```

- Padding: `48px 24px`; icon: `color: #a7aaad`; text: `14px`, `color: #646970`.

---

## Đăng nhập / Auth

- Nền trang: `--color-bg-page`.
- Khối form: card trắng, `max-width: 420px`, `border-radius: 20px`, `box-shadow: var(--shadow-md)`, `padding: 40px`.
- **Không** dùng dark full-screen cho auth.

---

## Tailwind patterns hay dùng

### Layout

```
flex flex-col items-center justify-between
flex items-center gap-2
flex min-w-0 flex-1 items-center gap-2   ← quan trọng cho truncate trong flex
grid grid-cols-1 gap-4
```

### Sizing

```
w-full h-full
w-10 h-10 shrink-0         ← icon container cố định
min-w-0                    ← bắt buộc khi truncate trong flex
```

### Hiển thị văn bản

```
truncate                   ← text-overflow: ellipsis + overflow hidden + nowrap
line-clamp-1
whitespace-nowrap
```

### Compound patterns phổ biến

```tsx
// Icon container tròn
className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"

// Row có icon + text, text có thể truncate
className="flex min-w-0 flex-1 items-center gap-2"

// Khối highlight nhỏ (info box)
className="space-y-1 rounded-lg border border-blue-100 bg-blue-50/40 p-3"

// Empty call-to-action
className="flex flex-col items-center gap-3 bg-brand-soft px-6 py-8"

// Card với border + shadow
className="overflow-hidden rounded-2xl border border-[--color-border] shadow-sm"
```

---

## Checklist khi thêm màn hình mới

1. **Nền trang** = `#f0f0f1`; khối nổi = trắng + viền WP + `shadow-sm`.
2. **CTA chính** = `<Button type="primary">` (chỉ một per màn).
3. **Spacing** chỉ dùng bậc 4/8/12/16/20/24/32/40/48px.
4. **List trong popup**: gap dọc ≥ 8px (nên 12px), padding vùng list ≥ 12px.
5. **Bo góc** card/bảng/modal = 12px (`rounded-2xl`).
6. **Card nhiều đoạn + nút**: dùng `wizard-card-body` + `wizard-card-actions` (hoặc `gap-6` + action row `border-t pt-6`).
7. **Bảng**: header chữ hoa 12px, padding ô 16/24px, `rounded-2xl`, `shadow-sm`.
8. **Typography**: đúng scale (22/18/15/14/13/12px), font Be Vietnam Pro.
9. **Màu**: chỉ dùng token — không hard-code hex ngoài bảng.
10. **Shadow**: chỉ `shadow-sm` / `shadow-md` — không gradient, không glow.
11. **Sidebar/header**: không tự đổi sang màu khác hệ WP trừ khi cập nhật đồng bộ `tokens.css` + `_app.tsx`.

---

## Không nên

- Copy nguyên mã mẫu từ prompt ngoài nếu dùng thư viện/hook không có trong repo (ví dụ `lucide-react`, `useUser` giả định) — thay bằng Ant Design + Iconify + hook auth/profile thực tế.
- Gradient nặng trên card/header/logo.
- Bóng nhiều lớp / glow brand.
- Hard-code hex ngoài bảng màu trên (trừ ảnh/illustration đặc thù).
- `text-transform: uppercase` toàn cục cho mọi label form (chỉ dùng có chủ đích: header bảng, section sidebar).
- Dùng lại palette cũ (`indigo #4F46E5`, stone `#f5f4f2`…).
- Thêm màu/variant mới khi đã có token tương đương.

---

*Cập nhật: đồng bộ với `apps/web/src/styles/tokens.css`, `globals.css`, `shell.css`, theme Ant Design trong `_app.tsx`, và hằng upload `@expense/types`. Mục «Đa theme» tóm tắt cách dùng prompt/theme ngoài mà không lệch stack (Next.js, Ant Design, Prisma).*
