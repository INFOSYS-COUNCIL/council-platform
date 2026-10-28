"use client";

import { useState } from "react";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/email";
import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    setFailed(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // hd는 계정 선택 화면의 힌트일 뿐이다. 실제 차단은 DB의 Auth Hook이 한다.
        queryParams: { hd: SCHOOL_EMAIL_DOMAIN, prompt: "select_account" },
      },
    });

    // 성공하면 Google로 이동하므로 여기까지 오지 않는다.
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Google로 이동하는 중…" : "학교 Google 계정으로 로그인"}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
