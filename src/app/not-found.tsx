import Link from "next/link";

// 없는 주소와 권한 없는 화면을 구분하지 않는다. 자료가 있는지조차 드러내지 않기 위해서다(기획서 부록 C.2).
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
      <p className="text-sm font-medium text-coral-800 dark:text-coral-300">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">찾을 수 없거나 볼 권한이 없습니다</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        주소를 확인하거나, 필요한 권한이 있는지 회장단에게 문의해 주세요.
      </p>
      <Link
        href="/me"
        className="inline-flex min-h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        내 계정으로 가기
      </Link>
    </main>
  );
}
