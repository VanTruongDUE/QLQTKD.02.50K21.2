import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../../.env"), quiet: true });
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; configure root .env`);
  return value;
}
export function secret(name: string) {
  const value = required(name);
  if (value.length < 32)
    throw new Error(`${name} must have at least 32 characters`);
  return value;
}
