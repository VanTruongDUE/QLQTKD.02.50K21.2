import {
  PaymentGateway,
  TransferResult,
  VerifiedMoneyEvent,
} from "../src/payments";
export class TestGateway extends PaymentGateway {
  override readonly name = "TEST_ONLY";
  override assertConfigured() {
    if (process.env.NODE_ENV !== "test")
      throw new Error("Test gateway outside tests");
  }
  override async charge(): Promise<TransferResult> {
    this.assertConfigured();
    return { status: "PENDING" };
  }
  override async refund(): Promise<TransferResult> {
    this.assertConfigured();
    return { status: "PENDING" };
  }
  override async query(): Promise<VerifiedMoneyEvent> {
    throw new Error("Test must provide verified evidence");
  }
}
