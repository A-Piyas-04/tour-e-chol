import { describe, expect, it } from "vitest";
import { getUserNames } from "./display-name";

describe("user display names", () => {
  it("keeps the Google name when no nickname is set", () => {
    expect(getUserNames({ full_name: "Ayesha Rahman" }, "ayesha@example.com")).toEqual({
      defaultName: "Ayesha Rahman",
      nickname: null,
      name: "Ayesha Rahman",
    });
  });

  it("uses a trimmed nickname while retaining the original name for clearing", () => {
    expect(getUserNames({ full_name: "Ayesha Rahman", nickname: "  Asha  " }).name).toBe("Asha");
    expect(getUserNames({ full_name: "Ayesha Rahman", nickname: null }).name).toBe("Ayesha Rahman");
  });

  it("ignores malformed nickname metadata", () => {
    expect(getUserNames({ name: "Ayesha", nickname: "line\nbreak" }).name).toBe("Ayesha");
    expect(getUserNames({ name: "Ayesha", nickname: "x".repeat(41) }).name).toBe("Ayesha");
  });
});
