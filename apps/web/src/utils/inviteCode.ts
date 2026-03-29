/** Hiển thị mã mời dễ đọc (bản copy API vẫn là chuỗi gốc). */
export function formatInviteCodeDisplay(code: string): string {
  if (code.length <= 10) return code
  return code.match(/.{1,4}/g)?.join(' · ') ?? code
}
