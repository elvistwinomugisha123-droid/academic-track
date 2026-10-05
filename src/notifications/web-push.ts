import "server-only";
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

function decode(value: string) { return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
function encode(value: Uint8Array | string) { return Buffer.from(value).toString("base64url"); }
function info(label: string) { return Buffer.from(`${label}\0`, "utf8"); }

export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string };
export type WebPushPayload = { title: string; body: string; deepLink: string; tag: string };

function vapidToken(endpoint: string, subject: string, publicKey: Buffer, privateKey: Buffer, now: Date) {
  const x = publicKey.subarray(1, 33); const y = publicKey.subarray(33, 65);
  const key = createPrivateKey({ key: { kty: "EC", crv: "P-256", x: encode(x), y: encode(y), d: encode(privateKey) }, format: "jwk" });
  const header = encode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const audience = new URL(endpoint).origin;
  const claims = encode(JSON.stringify({ aud: audience, exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60, sub: subject }));
  const unsigned = `${header}.${claims}`;
  return `${unsigned}.${encode(sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }))}`;
}

function encrypt(subscription: WebPushSubscription, payload: WebPushPayload) {
  const receiverPublicKey = decode(subscription.p256dh); const authSecret = decode(subscription.auth);
  if (receiverPublicKey.length !== 65 || authSecret.length !== 16) throw new Error("Invalid Web Push subscription keys.");
  const sender = createECDH("prime256v1"); sender.generateKeys();
  const senderPublicKey = sender.getPublicKey(); const sharedSecret = sender.computeSecret(receiverPublicKey);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiverPublicKey, senderPublicKey]);
  const inputKey = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));
  const salt = randomBytes(16);
  const contentKey = Buffer.from(hkdfSync("sha256", inputKey, salt, info("Content-Encoding: aes128gcm"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", inputKey, salt, info("Content-Encoding: nonce"), 12));
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payload), "utf8"), Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(senderPublicKey.length, 20);
  return Buffer.concat([header, senderPublicKey, ciphertext]);
}

export async function sendWebPush(input: { subscription: WebPushSubscription; payload: WebPushPayload; vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string; now?: Date }) {
  const publicKey = decode(input.vapidPublicKey); const privateKey = decode(input.vapidPrivateKey);
  if (publicKey.length !== 65 || privateKey.length !== 32) throw new Error("VAPID keys must be URL-safe P-256 public/private keys.");
  if (!/^(mailto:|https:\/\/)/.test(input.vapidSubject)) throw new Error("VAPID_SUBJECT must be a mailto: or HTTPS contact.");
  const token = vapidToken(input.subscription.endpoint, input.vapidSubject, publicKey, privateKey, input.now ?? new Date());
  const response = await fetch(input.subscription.endpoint, {
    method: "POST", body: encrypt(input.subscription, input.payload) as unknown as BodyInit, signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `vapid t=${token}, k=${input.vapidPublicKey}`, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "300", Urgency: "normal" },
  });
  return { ok: response.ok, status: response.status };
}
