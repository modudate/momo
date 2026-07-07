"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/browser";

// 현재 로그인 사용자 (없으면 null). 로딩 중에는 undefined.
export function useUser() {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) {
      setCurrentUser(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  return currentUser;
}
