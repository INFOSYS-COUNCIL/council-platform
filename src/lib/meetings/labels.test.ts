import { describe, expect, it } from "vitest";
import { fromBytea, toBytea } from "./labels";

describe("bytea 변환", () => {
  it("Uint8Array를 \\x 16진수로 바꾸고 되돌린다", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(toBytea(bytes)).toBe("\\x00010f10ff");
    expect(fromBytea(toBytea(bytes))).toEqual(bytes);
  });

  it("빈 값도 다룬다", () => {
    expect(fromBytea("\\x")).toEqual(new Uint8Array());
  });

  it("형식이 다르면 오류를 낸다", () => {
    expect(() => fromBytea("abc")).toThrow();
    expect(() => fromBytea("\\x0")).toThrow();
  });
});
