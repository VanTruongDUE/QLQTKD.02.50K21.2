import { Injectable } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { fail } from "./http";

export type TransferResult = {
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  reference?: string;
  checkoutUrl?: string;
};
export type VerifiedMoneyEvent = {
  eventId: string;
  id: string;
  amount: number;
  currency: "VND";
  status: "SUCCEEDED" | "FAILED";
};
// A concrete provider must verify its raw webhook and query ambiguous transfers.
// The default port deliberately has no success path or generic HMAC callback.
@Injectable()
export class PaymentGateway {
  readonly name: string = "MOMO";
  private config() {
    return {
      partnerCode: process.env.MOMO_PARTNER_CODE || "",
      accessKey: process.env.MOMO_ACCESS_KEY || "",
      secretKey: process.env.MOMO_SECRET_KEY || "",
      apiUrl: process.env.MOMO_API_URL || "https://test-payment.momo.vn/v2/gateway/api/create",
      redirectUrl: process.env.MOMO_REDIRECT_URL || "",
      ipnUrl: process.env.MOMO_IPN_URL || "",
    };
  }
  assertConfigured(): void {
    const config = this.config();
    if (!config.partnerCode || !config.accessKey || !config.secretKey || !config.redirectUrl || !config.ipnUrl)
      fail("PAYMENT_NOT_CONFIGURED", "Chưa cấu hình đầy đủ tài khoản MoMo.", 503);
  }
  private sign(value: string) {
    return createHmac("sha256", this.config().secretKey).update(value).digest("hex");
  }
  async charge(id: string, amount: number): Promise<TransferResult> {
    this.assertConfigured();
    const config = this.config();
    const requestId = randomUUID();
    const orderInfo = `Thanh toán vé Starlight ${id}`;
    const extraData = "";
    const requestType = "captureWallet";
    const raw = `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${config.ipnUrl}&orderId=${id}&orderInfo=${orderInfo}&partnerCode=${config.partnerCode}&redirectUrl=${config.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        partnerCode: config.partnerCode,
        partnerName: "Starlight Cinema",
        storeId: "StarlightCinema",
        requestId,
        amount,
        orderId: id,
        orderInfo,
        redirectUrl: config.redirectUrl,
        ipnUrl: config.ipnUrl,
        lang: "vi",
        requestType,
        autoCapture: true,
        extraData,
        signature: this.sign(raw),
      }),
    });
    const result = await response.json() as { resultCode?: number; message?: string; payUrl?: string };
    if (!response.ok || result.resultCode !== 0 || !result.payUrl)
      fail("PAYMENT_PROVIDER_ERROR", result.message || "MoMo không thể tạo giao dịch.", 502);
    return { status: "PENDING", reference: requestId, checkoutUrl: result.payUrl };
  }
  async refund(
    _id: string,
    _originalPaymentId: string,
    _amount: number,
  ): Promise<TransferResult> {
    this.assertConfigured();
    throw new Error("unreachable");
  }
  async query(
    _kind: "payment" | "refund",
    _id: string,
  ): Promise<VerifiedMoneyEvent> {
    this.assertConfigured();
    throw new Error("unreachable");
  }
  verifyWebhook(
    raw: Buffer,
    _headers: Record<string, string>,
  ): VerifiedMoneyEvent {
    this.assertConfigured();
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw.toString("utf8")); }
    catch { fail("INVALID_MOMO_IPN", "Nội dung IPN MoMo không hợp lệ.", 400); }
    const required = ["partnerCode", "orderId", "requestId", "amount", "orderInfo", "orderType", "transId", "resultCode", "message", "payType", "responseTime", "extraData", "signature"];
    if (required.some((key) => body[key] === undefined)) fail("INVALID_MOMO_IPN", "IPN MoMo thiếu dữ liệu.", 400);
    if (body.partnerCode !== this.config().partnerCode) fail("INVALID_MOMO_IPN", "Sai Partner Code MoMo.", 400);
    const signed = `accessKey=${this.config().accessKey}&amount=${body.amount}&extraData=${body.extraData}&message=${body.message}&orderId=${body.orderId}&orderInfo=${body.orderInfo}&orderType=${body.orderType}&partnerCode=${body.partnerCode}&payType=${body.payType}&requestId=${body.requestId}&responseTime=${body.responseTime}&resultCode=${body.resultCode}&transId=${body.transId}`;
    const expected = Buffer.from(this.sign(signed), "utf8");
    const received = Buffer.from(String(body.signature), "utf8");
    if (expected.length !== received.length || !timingSafeEqual(expected, received))
      fail("INVALID_MOMO_SIGNATURE", "Chữ ký IPN MoMo không hợp lệ.", 401);
    return {
      eventId: String(body.requestId),
      id: String(body.orderId),
      amount: Number(body.amount),
      currency: "VND",
      status: Number(body.resultCode) === 0 ? "SUCCEEDED" : "FAILED",
    };
  }
}
