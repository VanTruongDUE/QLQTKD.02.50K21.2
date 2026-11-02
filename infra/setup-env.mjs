import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; left unchanged.");
} else {
  let text = readFileSync(".env.example", "utf8");
  for (const name of ["JWT_SECRET", "QR_SECRET"])
    text = text.replace(
      new RegExp(`^${name}=.*$`, "m"),
      `${name}=${randomBytes(32).toString("hex")}`,
    );
  writeFileSync(".env", text);
  console.log("Created .env with random local secrets.");
}
