const MESSAGES: Record<string, string> = {
  access_denied:
    "학교 Google 계정으로만 로그인할 수 있습니다. 다른 계정을 선택해 주세요.",
  exchange_failed: "로그인 처리 중 문제가 생겼습니다. 다시 시도해 주세요.",
  missing_code: "로그인 정보가 올바르지 않습니다. 다시 시도해 주세요.",
};

export async function LoginError({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await searchParams;
  if (typeof error !== "string") return null;

  const message = MESSAGES[error] ?? MESSAGES.exchange_failed;

  return (
    <p
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </p>
  );
}
