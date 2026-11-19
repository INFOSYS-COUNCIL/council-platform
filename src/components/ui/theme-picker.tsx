"use client";

import { useState, useSyncExternalStore } from "react";
import { THEME_KEY, type ThemePreference } from "@/lib/theme";
import { SelectField } from "./form-field";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-color-scheme"] });
  return () => observer.disconnect();
}

export function useColorScheme() {
  return useSyncExternalStore<"light" | "dark">(subscribe, () => document.documentElement.dataset.colorScheme === "dark" ? "dark" : "light", () => "light");
}

export function ThemePicker() {
  const preference = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme ?? "system", () => "system");
  const [message, setMessage] = useState("");

  function changeTheme(value: ThemePreference) {
    const root = document.documentElement;
    root.dataset.theme = value;
    root.dataset.colorScheme = value === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value === "maple" ? "light" : value === "rift" ? "dark" : value;
    try {
      localStorage.setItem(THEME_KEY, value);
      setMessage("화면 모드를 저장했습니다.");
    } catch {
      setMessage("화면 모드를 적용했습니다. 브라우저 저장소를 사용할 수 없어 새로고침하면 초기화됩니다.");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-surface p-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">화면 설정</h2>
      <SelectField
        label="화면 모드"
        name="theme"
        value={preference}
        onChange={(event) => changeTheme(event.target.value as ThemePreference)}
        options={[{ value: "light", label: "일반 모드 (라이트)" }, { value: "dark", label: "다크 모드" }, { value: "system", label: "기기 설정 따르기" }, { value: "maple", label: "메이플 (단풍 도트)" }, { value: "rift", label: "소환사의 협곡 (롤)" }]}
        hint="선택한 모드는 이 브라우저에 저장됩니다."
      />
      <p role="status" className="text-sm text-muted">{message}</p>
    </section>
  );
}
