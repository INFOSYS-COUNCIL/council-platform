"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/email";
import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    setFailed(false);

    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
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
      <Button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 w-full"
      >
        {pending ? "Google로 이동하는 중…" : "학교 Google 계정으로 로그인"}
      </Button>
      <p role="status" className="sr-only">
        {pending ? "Google로 이동하는 중…" : ""}
      </p>
      {failed && (
        <Alert>
          로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </Alert>
      )}
    </div>
  );
}
