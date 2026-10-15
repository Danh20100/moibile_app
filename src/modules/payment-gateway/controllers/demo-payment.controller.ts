import { createHash } from 'node:crypto';
import { Controller, Get, Headers, HttpException, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { DemoPaymentService } from '../services/demo-payment.service';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

const pageStyle = `:root{color-scheme:light dark;--paper:#fff;--canvas:#f8f7f4;--ink:#292927;--muted:#696964;--line:#e5e2dc;--primary:#b9432d;--soft:#f3f1ed}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:440px;margin:40px auto;padding:28px;background:var(--paper);border-radius:16px}header{font-weight:650;margin-bottom:32px}h1{font-size:28px;line-height:1.2;margin:0 0 20px}p{margin:16px 0}.notice{padding:16px;border-radius:12px;background:var(--soft);color:var(--ink)}.amount{font-size:32px;font-weight:700;margin:24px 0 8px;font-variant-numeric:tabular-nums}.reference{font-size:13px;color:var(--muted);overflow-wrap:anywhere}button,a{display:block;width:100%;margin-top:24px;padding:15px;border:0;border-radius:12px;background:var(--primary);color:#fff;text-align:center;font:650 16px/1.5 system-ui,sans-serif;text-decoration:none;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid var(--ink);outline-offset:4px}::selection{background:var(--primary);color:#fff}@media(max-width:480px){main{margin:0;min-height:100dvh;border-radius:0;padding:28px 24px}}@media(prefers-color-scheme:dark){:root{--paper:#202823;--canvas:#171d1a;--ink:#ecede5;--muted:#bbc5bc;--line:#4b594e;--soft:#2c352e;--primary:#b9432d}}`;
const styleHash = createHash('sha256').update(pageStyle).digest('base64');
const confirmedContent =
  '<h2>Thanh toán đã được xác nhận</h2><p>Đang chờ đối chiếu với các khoản phải thu.</p><a href="trooi://payment/demo">Về TrọƠi</a>';

@Public()
@Controller('finance/checkouts/demo/pay')
export class DemoPaymentController {
  constructor(private readonly demoPayment: DemoPaymentService) {}

  @Get(':token')
  async readPage(@Param('token') token: string, @Res() response: Response): Promise<void> {
    this.headers(response);
    try {
      const record = await this.demoPayment.readPage(token);
      response
        .status(200)
        .type('html')
        .send(
          this.page(
            record.status === 'SUCCEEDED'
              ? confirmedContent
              : `<p>Số tiền thanh toán</p><p class="amount">${escapeHtml(new Intl.NumberFormat('vi-VN').format(Number(record.amount)))}đ</p><p class="reference">Mã tham chiếu: ${escapeHtml(record.referenceCode)}</p><form method="post" action="${escapeHtml(`/api/v1/finance/checkouts/demo/pay/${token}/success`)}"><button type="submit">Xác nhận thanh toán</button></form>`,
          ),
        );
    } catch (error) {
      this.error(response, error);
    }
  }

  @Post(':token/success')
  async confirm(
    @Param('token') token: string,
    @Headers('origin') origin: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    this.headers(response);
    try {
      await this.demoPayment.confirm(token, origin);
      response.status(200).type('html').send(this.page(confirmedContent));
    } catch (error) {
      this.error(response, error);
    }
  }

  private headers(response: Response): void {
    response.set({
      'Cache-Control': 'no-store',
      // Preserve the origin on browser form POSTs without forwarding the signed URL path.
      'Referrer-Policy': 'strict-origin',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'none'; style-src 'sha256-${styleHash}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    });
  }

  private page(content: string): string {
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TrọƠi DemoPay — MÔ PHỎNG</title><style>${pageStyle}</style></head><body><main><header>TrọƠi · DemoPay</header><h1>Thanh toán</h1><p class="notice">MÔ PHỎNG · Không chuyển tiền thật.</p>${content}</main></body></html>`;
  }

  private error(response: Response, error: unknown): void {
    const status =
      error instanceof HttpException && [403, 404, 409, 503].includes(error.getStatus())
        ? error.getStatus()
        : 500;
    const messages: Record<number, string> = {
      403: 'Liên kết thanh toán không hợp lệ. Về ứng dụng để mở lại thanh toán.',
      404: 'Không tìm thấy thanh toán. Về ứng dụng để kiểm tra lại.',
      409: 'Thanh toán chưa thể tiếp tục. Về ứng dụng để kiểm tra trạng thái.',
      503: 'Dịch vụ thanh toán tạm thời chưa khả dụng. Vui lòng thử lại sau.',
      500: 'Chưa xử lý được thanh toán. Vui lòng thử lại sau.',
    };
    response
      .status(status)
      .type('html')
      .send(this.page(`<p>${messages[status]}</p>`));
  }
}
