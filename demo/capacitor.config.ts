import type { CapacitorConfig } from "@capacitor/cli";

// 앱 식별자 — 출시 전 실제 도메인 역순으로 교체 권장 (예: kr.co.회사도메인.moim)
const config: CapacitorConfig = {
  appId: "kr.co.impulse.moim",
  appName: "모두의 모임",
  // server.url 사용 시 실제 화면은 원격(배포된 웹)에서 로드됨.
  // webDir 은 필수값이라 정적 자산 폴더를 지정 (오프라인 fallback 용도).
  webDir: "public",
  server: {
    // 배포된 웹을 그대로 네이티브 WebView 로 로드 → 웹 업데이트가 앱에 즉시 반영
    url: "https://mazu-demo.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
