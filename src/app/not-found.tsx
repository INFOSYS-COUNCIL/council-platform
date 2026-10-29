import Link from "next/link";

// 없는 주소와 권한 없는 화면을 구분하지 않는다. 자료가 있는지조차 드러내지 않기 위해서다(기획서 부록 C.2).
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-bold">찾을 수 없거나 볼 권한이 없습니다</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        주소를 확인하거나, 필요한 권한이 있는지 회장단에게 문의해 주세요.
      </p>
      <Link href="/me" className="inline-block underline">
        내 계정으로 가기
      </Link>
    </main>
  );
}
