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
              ? '<p>Thanh toán đã được xác nhận</p>'
              : `<p>Số tiền: ${escapeHtml(record.amount)} VND</p><p>Mã tham chiếu: ${escapeHtml(record.referenceCode)}</p><form method="post" action="${escapeHtml(`/api/v1/finance/checkouts/demo/pay/${token}/success`)}"><button type="submit">Xác nhận thanh toán</button></form>`,
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
      response.status(200).type('html').send(this.page('<p>Thanh toán đã được xác nhận</p>'));
    } catch (error) {
      this.error(response, error);
    }
  }

  private headers(response: Response): void {
    response.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
  }

  private page(content: string): string {
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TrọƠi DemoPay — MÔ PHỎNG</title></head><body><main><h1>TrọƠi DemoPay — MÔ PHỎNG</h1><p>Thanh toán mô phỏng, không chuyển tiền thật.</p>${content}</main></body></html>`;
  }

  private error(response: Response, error: unknown): void {
    const status =
      error instanceof HttpException && [403, 404, 409, 503].includes(error.getStatus())
        ? error.getStatus()
        : 500;
    const messages: Record<number, string> = {
      403: 'Forbidden',
      404: 'Not found',
      409: 'Conflict',
      503: 'Service unavailable',
      500: 'Internal server error',
    };
    response
      .status(status)
      .type('html')
      .send(this.page(`<p>${messages[status]}</p>`));
  }
}
