import { randomBytes } from "node:crypto";
process.env.PAYMENT_MODE = "momo";
process.env.DEMO_PASSWORD = randomBytes(24).toString("base64url");
process.env.SMTP_FROM = "Starlight Tests <tickets@starlight.test>";
