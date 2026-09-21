import { describe, expect, it } from "vitest";
import {
  NAME_MAX,
  NAME_MIN,
  nameRejection,
  normalizeDisplayName,
} from "@/convex/identityCore";

describe("normalizeDisplayName", () => {
  it("يوحّد المسافات المتعددة", () => {
    expect(normalizeDisplayName("  الصقر   الجريء  ")).toBe("الصقر الجريء");
  });

  it("يزيل محارف الصفر-العرض (انتحال الأسماء)", () => {
    // "admin" مع zero-width chars بين الحروف يجب أن يصبح "admin"
    const spoofed = "a\u200Bd\u200Cm\u200Di\u200En";
    expect(normalizeDisplayName(spoofed)).toBe("admin");
  });

  it("يزيل محارف التحكم", () => {
    expect(normalizeDisplayName("ab\u0000cd")).toBe("abcd");
  });

  it("يقصّ عند الحد الأقصى", () => {
    expect(normalizeDisplayName("x".repeat(100)).length).toBe(NAME_MAX);
  });
});

describe("nameRejection", () => {
  it("يرفض الاسم القصير", () => {
    expect(nameRejection("ا", false)).toContain("قصير");
  });

  it("يرفض اسماً محجوزاً للاعب آخر", () => {
    expect(nameRejection("الصقر", true)).toContain("محجوز");
  });

  it("يقبل اسماً متاحاً نظيفاً", () => {
    expect(nameRejection("الصقر الجريء", false)).toBeNull();
  });

  it("يرفض أسماء النظام المحجوزة", () => {
    expect(nameRejection("admin", false)).toContain("للنظام");
    expect(nameRejection("OWNER", false)).toContain("للنظام");
    expect(nameRejection("المالك", false)).toContain("للنظام");
  });

  it("التطبيع يسبق الفحص — الاسم المخفي بمحارف لا يمرّ", () => {
    const spoofed = "a\u200Bdmin";
    // بعد التطبيع يصبح "admin" وهو محجوز للنظام
    expect(nameRejection(spoofed, false)).toContain("للنظام");
  });

  it("الثوابت منطقية", () => {
    expect(NAME_MIN).toBe(2);
    expect(NAME_MAX).toBe(24);
  });
});
