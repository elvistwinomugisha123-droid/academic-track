import { createECDH } from "node:crypto";

const key = createECDH("prime256v1"); key.generateKeys();
console.log("Generate these values once, store them in the pilot deployment secret manager, and do not commit them:");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${key.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${key.getPrivateKey().toString("base64url")}`);
