// Integer-paisa money handling. ৳1 = 100 paisa.
// All stored and computed amounts are integer paisa; never floating-point BDT.

// Matches the DB cap: expenses.amount_paisa <= 1_000_000_000_000.
export const MAX_PAISA = 1_000_000_000_000;

export class MoneyError extends Error {}

/**
 * Parse a user-typed BDT string into integer paisa by reading the decimal
 * digits directly (NOT parseFloat(value) * 100, which is lossy).
 *
 * Accepts: "60", "60.5", "60.50", " 60.50 " (surrounding whitespace).
 * Rejects: negatives, "0", "0.00", "1.234" (>2 decimals), empty/malformed
 *          strings, NaN/Infinity text, and values above MAX_PAISA.
 */
export function parseTakaToPaisa(input: string): number {
  if (typeof input !== "string") {
    throw new MoneyError("Amount must be a string.");
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new MoneyError("Amount is required.");
  }
  // Strictly: optional integer part, optional 1-2 decimal places. No sign,
  // no exponent, no thousands separators. This rejects NaN/Infinity text too.
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new MoneyError(`"${input}" is not a valid amount (max 2 decimals).`);
  }
  const whole = match[1];
  const frac = (match[2] ?? "").padEnd(2, "0");

  const wholePaisa = Number(whole) * 100;
  const fracPaisa = Number(frac);
  const paisa = wholePaisa + fracPaisa;

  if (!Number.isSafeInteger(paisa)) {
    throw new MoneyError("Amount is too large.");
  }
  if (paisa <= 0) {
    throw new MoneyError("Amount must be greater than zero.");
  }
  if (paisa > MAX_PAISA) {
    throw new MoneyError("Amount exceeds the allowed maximum.");
  }
  return paisa;
}

/**
 * Coerce a value coming back from the database (Supabase may return bigint
 * columns as strings) into a safe integer paisa count.
 */
export function coercePaisa(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || !Number.isSafeInteger(n)) {
    throw new MoneyError("Stored amount is not a safe integer.");
  }
  if (n < 0 || n > MAX_PAISA) {
    throw new MoneyError("Stored amount is out of range.");
  }
  return n;
}

/** Format integer paisa as a plain "90.00" string (no currency symbol). */
export function formatPaisa(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole.toLocaleString("en-US")}.${frac.toString().padStart(2, "0")}`;
}

/** Format integer paisa with the Taka symbol, e.g. "৳90.00". */
export function formatTaka(paisa: number): string {
  return `৳${formatPaisa(paisa)}`;
}
