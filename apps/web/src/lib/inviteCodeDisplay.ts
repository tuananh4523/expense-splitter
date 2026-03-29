/** Hiển thị mã mời dạng XXXX-XXXX-XXXX-XXXX (cuid / mã thật vẫn dùng khi join). */
export function formatInviteCodeDisplay(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const padded = (cleaned + '0000000000000000').slice(0, 16)
  const parts = padded.match(/.{1,4}/g)
  return parts ? parts.join('-') : cleaned
}
