"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

// 로그인 유지 기간 — 세션 쿠키 수명으로 제어한다.
const REMEMBER_SECONDS = 7 * 24 * 60 * 60; // 자동 로그인 체크: 7일(168시간)
const SHORT_SECONDS = 12 * 60 * 60; // 체크 해제: 12시간(그날만)

// 브라우저용 클라이언트 (로그인/회원가입 등). anon 키 사용.
let _client: SupabaseClient | null = null;
let _maxAge = REMEMBER_SECONDS;

// 로그인 화면의 "자동 로그인 (7일)" 체크박스 값 반영.
//  쿠키 수명이 달라져야 하므로, 값이 바뀌면 클라이언트를 다시 만들어 새 수명으로 쿠키를 쓰게 한다.
export function setRememberMe(remember: boolean) {
  const next = remember ? REMEMBER_SECONDS : SHORT_SECONDS;
  if (next !== _maxAge) {
    _maxAge = next;
    _client = null; // 다음 getBrowserClient() 에서 새 수명으로 재생성
  }
}

export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookieOptions: { maxAge: _maxAge },
    });
  }
  return _client;
}
