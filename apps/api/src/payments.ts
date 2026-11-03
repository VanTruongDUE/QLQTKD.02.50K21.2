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
  reference?: string;
};
// A concrete provider must verify its raw webhook and query ambiguous transfers.
// The default port deliberately has no success path or generic HMAC callback.
@Injectable()
export class PaymentGateway {
  readonly name: string = process.env.PAYMENT_MODE === "mock" ? "MOCK" : "MOMO";
  private config() {
    return {
      partnerCode: process.env.MOMO_PARTNER_CODE || "",
      accessKey: process.env.MOMO_ACCESS_KEY || "",
      secretKey: process.env.MOMO_SECRET_KEY || "",
      apiUrl: process.env.MOMO_API_URL || "https://test-payment.momo.vn/v2/gateway/api/create",
      redirectUrl: process.env.MOMO_REDIRECT_URL || "",
      ipnUrl: process.env.MOMO_IPN_URL || "",
      refundUrl: process.env.MOMO_REFUND_URL || "https://test-payment.momo.vn/v2/gateway/api/refund",
      queryUrl: process.env.MOMO_QUERY_URL || "https://test-payment.momo.vn/v2/gateway/api/query",
      refundQueryUrl: process.env.MOMO_REFUND_QUERY_URL || "https://test-payment.momo.vn/v2/gateway/api/refund/query",
    };
  }
  assertConfigured(): void {
    if (this.name === "MOCK") {
      if (
        process.env.NODE_ENV === "production" &&
        process.env.PUBLIC_DEMO_MODE !== "true"
      )
        fail("PAYMENT_NOT_CONFIGURED", "Payment mock bị tắt trong production.", 503);
      return;
    }
    const config = this.config();
    const missing = [
      ["MOMO_PARTNER_CODE", config.partnerCode],
      ["MOMO_ACCESS_KEY", config.accessKey],
      ["MOMO_SECRET_KEY", config.secretKey],
      ["MOMO_REDIRECT_URL", config.redirectUrl],
      ["MOMO_IPN_URL", config.ipnUrl],
    ].filter(([, value]) => !value).map(([key]) => key);
    const invalidUrl = [config.redirectUrl, config.ipnUrl].some((value) => {
      try {
        return !value || !/^https?:$/.test(new URL(value).protocol) || value.includes("your-public-domain.example");
      } catch {
        return true;
      }
    });
    if (missing.length || invalidUrl)
      fail("PAYMENT_NOT_CONFIGURED", missing.length
        ? `MoMo chưa cấu hình đầy đủ: ${missing.join(", ")}`
        : "MoMo chưa cấu hình đầy đủ. Kiểm tra MOMO_REDIRECT_URL và MOMO_IPN_URL.", 503);
  }
  private sign(value: string) {
    return createHmac("sha256", this.config().secretKey).update(value).digest("hex");
  }
  async charge(id: string, amount: number): Promise<TransferResult> {
    this.assertConfigured();
    if (this.name === "MOCK")
      return {
        status: "SUCCEEDED",
        reference: `mock-${randomUUID()}`,
        checkoutUrl: `${process.env.MOMO_REDIRECT_URL || "http://localhost:3000/"}?payment=mock&paymentId=${encodeURIComponent(id)}&amount=${amount}`,
      };
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
    id: string,
    originalTransactionId: string,
    amount: number,
  ): Promise<TransferResult> {
    this.assertConfigured();
    const config = this.config();
    const requestId = randomUUID();
    const description = `Hoàn tiền vé Starlight ${id}`;
    const raw = `accessKey=${config.accessKey}&amount=${amount}&description=${description}&orderId=${id}&partnerCode=${config.partnerCode}&requestId=${requestId}&transId=${originalTransactionId}`;
    const response = await fetch(config.refundUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ partnerCode: config.partnerCode, orderId: id, requestId, amount, transId: originalTransactionId, lang: "vi", description, signature: this.sign(raw) }),
    });
    const result = await response.json() as { resultCode?: number; message?: string; transId?: string | number };
    if (!response.ok) fail("PAYMENT_PROVIDER_ERROR", result.message || "MoMo không thể hoàn tiền.", 502);
    if (result.resultCode === 0) return { status: "SUCCEEDED", reference: String(result.transId || requestId) };
    if (result.resultCode === 9000) return { status: "PENDING", reference: requestId };
    return { status: "FAILED", reference: requestId };
  }
  async query(
    kind: "payment" | "refund",
    id: string,
  ): Promise<VerifiedMoneyEvent> {
    this.assertConfigured();
    const config = this.config();
    const requestId = randomUUID();
    const url = kind === "refund" ? config.refundQueryUrl : config.queryUrl;
    const raw = `accessKey=${config.accessKey}&orderId=${id}&partnerCode=${config.partnerCode}&requestId=${requestId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ partnerCode: config.partnerCode, requestId, orderId: id, lang: "vi", signature: this.sign(raw) }),
    });
    const result = await response.json() as { resultCode?: number; amount?: number; transId?: string | number; message?: string };
    if (!response.ok) fail("PAYMENT_PROVIDER_ERROR", result.message || "MoMo không thể truy vấn giao dịch.", 502);
    if (result.resultCode === 9000) fail("PAYMENT_PENDING", "MoMo chưa trả kết quả cuối cùng.", 409);
    const status = result.resultCode === 0 ? "SUCCEEDED" : "FAILED";
    return { eventId: requestId, id, amount: Number(result.amount || 0), currency: "VND", status, reference: result.transId ? String(result.transId) : undefined };
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
      reference: String(body.transId),
    };
  }
}
