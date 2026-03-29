/** Giới hạn một file ảnh — dùng chung web + presign API */
export const MAX_IMAGE_UPLOAD_MB = 100 as const
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024
