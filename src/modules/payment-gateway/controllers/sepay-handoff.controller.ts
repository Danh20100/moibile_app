import { randomBytes } from 'node:crypto';

import { Controller, Get, Inject, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { SEPAY_PRODUCTION_CHECKOUT_URL } from '../sepay/sepay-form';
import { SepayHandoffService, type SepayHandoffView } from '../services/sepay-handoff.service';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

export function sepayReturnHtml(result: string): string {
  const label =
    result === 'success'
      ? 'SePay đã chuyển trình duyệt về'
      : result === 'error'
        ? 'SePay báo lỗi trên trình duyệt'
        : 'SePay báo đã hủy trên trình duyệt';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="refresh" content="1;url=trooi://payment/sepay"><title>TrọƠi</title></head><body><main><h1>${escapeHtml(label)}</h1><p>Trang quay về không phải xác nhận đã thanh toán. Hãy đối soát trong TrọƠi.</p><p><a href="trooi://payment/sepay">Quay về TrọƠi</a></p></main></body></html>`;
}

function page(body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thanh toán SePay</title></head><body><main>${body}</main></body></html>`;
}

export function sepayHandoffHtml(view: SepayHandoffView, token: string, nonce = ''): string {
  const submit = nonce
    ? `<script nonce="${escapeHtml(nonce)}">document.forms[0]&&document.forms[0].submit()</script>`
    : '';
  if (view.kind === 'form') {
    const inputs = Object.entries(view.fields)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
      )
      .join('');
    return page(
      `<h1>Chuyển tới SePay</h1><p>Biểu mẫu này mở trang chuyển khoản. Việc gửi biểu mẫu chưa ghi nhận thanh toán.</p><form method="post" action="${escapeHtml(view.action)}">${inputs}<button type="submit">Tiếp tục chuyển khoản</button></form>${submit}`,
    );
  }
  if (view.kind === 'issued') {
    return page(
      '<h1>Biểu mẫu đã được phát hành</h1><p>Trang này không ký biểu mẫu mới và không xác nhận đã thanh toán. Hãy đối soát trong TrọƠi sau khi chuyển khoản.</p>',
    );
  }
  const amount = escapeHtml(view.record.amount);
  const reference = escapeHtml(view.record.referenceCode);
  return page(
    `<h1>Chuyển khoản ngân hàng</h1><p>${amount} VND</p><p>${reference}</p><form method="post" action="/api/v1/finance/checkouts/sepay/handoff?token=${escapeHtml(encodeURIComponent(token))}"><button type="submit">Mở SePay</button></form>${submit}`,
  );
}

@Public()
@Controller('finance/checkouts/sepay')
export class SepayHandoffController {
  constructor(@Inject(SepayHandoffService) private readonly handoff: SepayHandoffService) {}

  @Get('handoff')
  async readHandoff(@Query('token') token: string, @Res() response: Response): Promise<void> {
    const nonce = randomBytes(16).toString('base64url');
    this.headers(response, "'self'", nonce);
    const view = await this.handoff.read(token ?? '');
    response
      .status(200)
      .type('html')
      .send(sepayHandoffHtml(view, token ?? '', nonce));
  }

  @Post('handoff')
  async releaseHandoff(@Query('token') token: string, @Res() response: Response): Promise<void> {
    const nonce = randomBytes(16).toString('base64url');
    this.headers(response, `'self' ${new URL(SEPAY_PRODUCTION_CHECKOUT_URL).origin}`, nonce);
    const view = await this.handoff.release(token ?? '');
    response
      .status(200)
      .type('html')
      .send(sepayHandoffHtml(view, token ?? '', nonce));
  }

  @Get('return/:result')
  returnPage(@Param('result') result: string, @Res() response: Response): void {
    this.headers(response, "'none'");
    if (result !== 'success' && result !== 'error' && result !== 'cancel') {
      response.status(404).type('html').send(page('<h1>Không có trang này</h1>'));
      return;
    }
    response.status(200).type('html').send(sepayReturnHtml(result));
  }

  private headers(response: Response, formAction: string, scriptNonce = ''): void {
    const script = scriptNonce ? `'nonce-${scriptNonce}'` : "'none'";
    response.set({
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src ${script}; style-src 'none'; form-action ${formAction}; base-uri 'none'; frame-ancestors 'none'`,
      'X-Content-Type-Options': 'nosniff',
    });
  }
}
