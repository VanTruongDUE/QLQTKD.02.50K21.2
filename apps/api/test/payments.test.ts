import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { PaymentGateway } from "../src/payments";

const saved = {
  partner: process.env.MOMO_PARTNER_CODE,
  access: process.env.MOMO_ACCESS_KEY,
  secret: process.env.MOMO_SECRET_KEY,
  redirect: process.env.MOMO_REDIRECT_URL,
  ipn: process.env.MOMO_IPN_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries({ MOMO_PARTNER_CODE: saved.partner, MOMO_ACCESS_KEY: saved.access, MOMO_SECRET_KEY: saved.secret, MOMO_REDIRECT_URL: saved.redirect, MOMO_IPN_URL: saved.ipn })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe("MoMo IPN verification", () => {
  it("accepts a valid signed IPN and rejects a changed signature", () => {
    process.env.MOMO_PARTNER_CODE = "PARTNER_TEST";
    process.env.MOMO_ACCESS_KEY = "ACCESS_TEST";
    process.env.MOMO_SECRET_KEY = "secret-test-key";
    process.env.MOMO_REDIRECT_URL = "http://localhost:3000/payment-result";
    process.env.MOMO_IPN_URL = "https://example.test/api/v1/webhooks/payments/momo";
    const body: Record<string, string | number> = {
      partnerCode: "PARTNER_TEST", orderId: "11111111-1111-4111-8111-111111111111", requestId: "22222222-2222-4222-8222-222222222222", amount: 85000,
      orderInfo: "Starlight", orderType: "momo_wallet", transId: 123456, resultCode: 0, message: "Success", payType: "qr", responseTime: 1730000000000, extraData: "",
    };
    const signed = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${body.amount}&extraData=${body.extraData}&message=${body.message}&orderId=${body.orderId}&orderInfo=${body.orderInfo}&orderType=${body.orderType}&partnerCode=${body.partnerCode}&payType=${body.payType}&requestId=${body.requestId}&responseTime=${body.responseTime}&resultCode=${body.resultCode}&transId=${body.transId}`;
    body.signature = createHmac("sha256", process.env.MOMO_SECRET_KEY!).update(signed).digest("hex");
    const gateway = new PaymentGateway();
    const verified = gateway.verifyWebhook(Buffer.from(JSON.stringify(body)), {});
    expect(verified).toMatchObject({ id: body.orderId, amount: 85000, status: "SUCCEEDED", reference: "123456" });
    body.signature = "invalid";
    expect(() => gateway.verifyWebhook(Buffer.from(JSON.stringify(body)), {})).toThrow("Chữ ký IPN MoMo không hợp lệ.");
  });
});
