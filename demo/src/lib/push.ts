import webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

export const isPushConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (isPushConfigured) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// 한 구독에 발송. 만료(404/410) 시 false 반환 → 호출측에서 정리 가능.
export async function sendPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<{ ok: boolean; expired: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true, expired: false };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, expired };
  }
}

export { webpush };
