import { createHash } from "node:crypto";
import { env } from "../../config.js";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashIp(ip: string) {
  return sha256(`${env.SCAN_HASH_SALT}:${ip}`);
}

export function normalizeWhatsapp(value: string) {
  return value.replace(/[^0-9]/g, "");
}
