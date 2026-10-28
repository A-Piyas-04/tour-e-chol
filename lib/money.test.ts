import { describe, it, expect } from "vitest";
import { parseTakaToPaisa, formatTaka, formatPaisa, coercePaisa, MoneyError } from "./money";

describe("parseTakaToPaisa", () => {
  it("parses whole and decimal amounts exactly", () => {
    expect(parseTakaToPaisa("60")).toBe(6000);
    expect(parseTakaToPaisa("60.5")).toBe(6050);
    expect(parseTakaToPaisa("60.50")).toBe(6050);
    expect(parseTakaToPaisa("1000")).toBe(100000);
    expect(parseTakaToPaisa(" 0.01 ")).toBe(1);
  });

  it("avoids binary float error (parses digits, not parseFloat*100)", () => {
    // 0.1 + 0.2 style rounding must not leak in.
    expect(parseTakaToPaisa("0.29")).toBe(29);
    expect(parseTakaToPaisa("8.70")).toBe(870);
  });

  it("rejects zero, negatives, too many decimals and junk", () => {
    for (const bad of ["0", "0.00", "-5", "1.234", "", "   ", "abc", "6e2", "NaN", "Infinity", "1,000", "1.", ".5"]) {
      expect(() => parseTakaToPaisa(bad), bad).toThrow(MoneyError);
    }
  });

  it("rejects values above the maximum", () => {
    expect(() => parseTakaToPaisa("10000000001")).toThrow(MoneyError);
  });
});

describe("formatting", () => {
  it("formats paisa with two decimals and a taka sign", () => {
    expect(formatPaisa(9000)).toBe("90.00");
    expect(formatPaisa(1)).toBe("0.01");
    expect(formatTaka(9000)).toBe("৳90.00");
    expect(formatTaka(100000)).toBe("৳1,000.00");
  });
});

describe("coercePaisa", () => {
  it("accepts numbers and numeric strings from the DB", () => {
    expect(coercePaisa(9000)).toBe(9000);
    expect(coercePaisa("9000")).toBe(9000);
  });
  it("rejects unsafe or out-of-range values", () => {
    expect(() => coercePaisa("not-a-number")).toThrow(MoneyError);
    expect(() => coercePaisa(-1)).toThrow(MoneyError);
  });
});
