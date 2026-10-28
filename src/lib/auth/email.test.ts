import { describe, expect, it } from "vitest";
import { isSchoolEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("앞뒤 공백을 지우고 소문자로 바꾼다", () => {
    expect(normalizeEmail("  Test.User@HANYANG.AC.KR ")).toBe(
      "test.user@hanyang.ac.kr",
    );
  });
});

describe("isSchoolEmail", () => {
  it("학교 도메인 이메일은 허용한다", () => {
    expect(isSchoolEmail("student@hanyang.ac.kr")).toBe(true);
  });

  it("대문자·공백이 섞여도 정규화한 뒤 허용한다", () => {
    expect(isSchoolEmail(" Student@Hanyang.AC.kr ")).toBe(true);
  });

  it.each([
    ["외부 Gmail", "student@gmail.com"],
    ["학교 하위 도메인", "student@mail.hanyang.ac.kr"],
    ["학교 도메인을 앞에 붙인 가짜 도메인", "student@hanyang.ac.kr.evil.com"],
    ["@가 두 개", "a@b@hanyang.ac.kr"],
    ["아이디 없음", "@hanyang.ac.kr"],
    ["중간 공백", "stu dent@hanyang.ac.kr"],
    ["빈 문자열", ""],
  ])("%s는 거부한다", (_label, email) => {
    expect(isSchoolEmail(email)).toBe(false);
  });

  it("null·undefined는 거부한다", () => {
    expect(isSchoolEmail(null)).toBe(false);
    expect(isSchoolEmail(undefined)).toBe(false);
  });
});
