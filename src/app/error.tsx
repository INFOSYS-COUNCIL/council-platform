"use client";

import { useEffect } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// 예상하지 못한 오류 화면 (기획서 부록 C.2). 기술적인 내용은 화면에 보이지 않는다.
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <Alert>불러오지 못했습니다.</Alert>
      <Button onClick={() => retry()}>다시 시도</Button>
    </div>
  );
}
