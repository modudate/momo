"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushStatus = "checking" | "unsupported" | "idle" | "subscribed" | "denied" | "working";

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [message, setMessage] = useState("");

  // 구독 정보를 서버에 저장(멱등). 성공 여부 반환.
  const saveSubscription = async (subscription: PushSubscription): Promise<boolean> => {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
    return response.ok;
  };

  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(vapidPublicKey);

    if (!isSupported) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      const existing = await registration?.pushManager.getSubscription();
      if (existing) {
        // 브라우저엔 구독이 있는데 서버 저장이 누락됐을 수 있어 재동기화
        await saveSubscription(existing).catch(() => false);
        setStatus("subscribed");
      } else {
        setStatus("idle");
      }
    });
  }, []);

  const subscribe = async () => {
    setStatus("working");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const saved = await saveSubscription(subscription);
      if (!saved) {
        setStatus("idle");
        setMessage("알림 설정에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setStatus("subscribed");
      setMessage("알림이 켜졌어요.");
    } catch {
      setStatus("idle");
      setMessage("알림 설정에 실패했어요.");
    }
  };

  const sendTest = async () => {
    setMessage("");
    const response = await fetch("/api/push/test", { method: "POST" });
    setMessage(response.ok ? "테스트 알림을 보냈어요." : "발송에 실패했어요.");
  };

  if (status === "checking") return null;

  if (status === "unsupported") {
    return (
      <p className="tds-caption">
        이 브라우저는 웹 알림을 지원하지 않아요. (아이폰은 홈 화면에 추가 후 가능)
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="tds-caption">
        알림이 차단돼 있어요. 브라우저 설정에서 알림을 허용해 주세요.
      </p>
    );
  }

  return (
    <div>
      {status === "subscribed" ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--accent-secondary)]">
            <Check size={16} /> 알림 켜짐
          </span>
          <button
            type="button"
            onClick={sendTest}
            className="ml-auto inline-flex items-center gap-1.5 px-3 h-9 rounded-[var(--radius-full)] bg-[var(--bg-surface)] text-[13px] font-semibold text-[var(--text-secondary)]"
          >
            <BellRing size={14} /> 테스트 발송
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={subscribe}
          disabled={status === "working"}
          className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white font-bold text-[15px] disabled:opacity-60"
        >
          <Bell size={18} /> {status === "working" ? "설정 중…" : "모임 알림 받기"}
        </button>
      )}
      {message && <p className="tds-caption mt-2">{message}</p>}
    </div>
  );
}
