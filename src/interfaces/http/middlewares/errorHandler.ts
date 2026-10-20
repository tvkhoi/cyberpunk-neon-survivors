import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err.status === 413 || err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: 'Payload quá lớn! Kích thước tối đa cho phép là 16KB.',
    });
    return;
  }
  if (err.status === 400 || err instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      error: 'Định dạng JSON gửi lên không hợp lệ.',
    });
    return;
  }
  res.status(500).json({
    success: false,
    error: 'Lỗi máy chủ nội bộ.',
  });
}
