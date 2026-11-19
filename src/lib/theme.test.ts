import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_KEY, THEME_SCRIPT } from "./theme";

function start(value: string | null, dark: boolean, blocked = false) {
  const dataset: Record<string, string> = {};
  const listeners: Record<string, (event?: { key: string | null; }) => void> = {};
  const media = { matches: dark, addEventListener: (_: string, listener: () => void) => { listeners.media = listener; } };
  const storage = { value };
  runInNewContext(THEME_SCRIPT, {
    document: { documentElement: { dataset } },
    window: { matchMedia: () => media, addEventListener: (name: string, listener: typeof listeners[string]) => { listeners[name] = listener; } },
    localStorage: { getItem: () => { if (blocked) throw new Error("blocked"); return storage.value; } },
  });
  return { dataset, listeners, media, storage };
}

describe("화면 모드 초기화", () => {
  it.each([["light", true], ["dark", false]] as const)("저장한 %s 모드가 기기 설정보다 우선한다", (value, dark) => {
    const { dataset, media, listeners } = start(value, dark);
    expect(dataset.colorScheme).toBe(value);
    media.matches = !dark;
    listeners.media();
    expect(dataset.colorScheme).toBe(value);
  });

  it.each([null, "system", "잘못된 값"])("선택이 %s이면 기기 설정 변경을 따른다", (value) => {
    const { dataset, media, listeners } = start(value, false);
    expect(dataset.theme).toBe("system");
    expect(dataset.colorScheme).toBe("light");
    media.matches = true;
    listeners.media();
    expect(dataset.colorScheme).toBe("dark");
  });

  it.each(["maple", "rift"])("%s 테마의 밝기를 새로고침과 기기 설정 변경 후에도 유지한다", (theme) => {
    for (const dark of [false, true]) {
      const { dataset, media, listeners } = start(theme, dark);
      expect(dataset).toEqual({ theme, colorScheme: theme === "rift" ? "dark" : "light" });
      media.matches = !dark;
      listeners.media();
      expect(dataset.colorScheme).toBe(theme === "rift" ? "dark" : "light");
    }
  });

  it("다른 탭에서 협곡과 메이플을 선택하면 편집기의 밝기도 전환한다", () => {
    const { dataset, storage, listeners } = start("maple", false);
    storage.value = "rift";
    listeners.storage({ key: THEME_KEY });
    expect(dataset).toEqual({ theme: "rift", colorScheme: "dark" });
    storage.value = "maple";
    listeners.storage({ key: THEME_KEY });
    expect(dataset).toEqual({ theme: "maple", colorScheme: "light" });
  });

  it("다른 탭의 변경과 저장소 초기화를 반영한다", () => {
    const { dataset, storage, listeners } = start("light", true);
    storage.value = "dark";
    listeners.storage({ key: "other-key" });
    expect(dataset.colorScheme).toBe("light");
    listeners.storage({ key: THEME_KEY });
    expect(dataset.colorScheme).toBe("dark");
    storage.value = null;
    listeners.storage({ key: null });
    expect(dataset.theme).toBe("system");
  });

  it("저장소 접근이 막혀도 기기 설정으로 화면을 연다", () => {
    expect(start(null, true, true).dataset.colorScheme).toBe("dark");
  });
});
