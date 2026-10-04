import { createECDH, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWebPush } from "./web-push";

afterEach(() => vi.unstubAllGlobals());

describe("native Web Push transport", () => {
  it("encrypts an aes128gcm payload and signs a VAPID request without exposing private keys", async () => {
    const vapid = createECDH("prime256v1"); vapid.generateKeys(); const receiver = createECDH("prime256v1"); receiver.generateKeys();
    const fetchMock = vi.fn<typeof fetch>(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendWebPush({
      subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/test", p256dh: receiver.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
      payload: { title: "Upcoming lesson", body: "Biology · S2 East starts at 8:00 am.", deepLink: "/workspace/teacher/lessons/lesson-id", tag: "delivery" },
      vapidPublicKey: vapid.getPublicKey().toString("base64url"), vapidPrivateKey: vapid.getPrivateKey().toString("base64url"), vapidSubject: "mailto:support@example.com", now: new Date("2026-10-03T00:00:00Z"),
    });
    expect(result).toEqual({ ok: true, status: 201 });
    const init = fetchMock.mock.calls[0][1];
    expect(init).toBeDefined();
    if (!init) throw new Error("Expected Web Push to provide fetch request options.");
    expect(init.headers).toMatchObject({ "Content-Encoding": "aes128gcm", TTL: "300" });
    expect(String((init.headers as Record<string, string>).Authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(Buffer.from(init.body as ArrayBuffer).toString("utf8")).not.toContain("Biology");
  });
});
