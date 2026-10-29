export const NICKNAME_MAX_LENGTH = 40;

export function getUserNames(metadata: Record<string, unknown> | undefined, email?: string) {
  const defaultName =
    (typeof metadata?.full_name === "string" && metadata.full_name) ||
    (typeof metadata?.name === "string" && metadata.name) ||
    email ||
    "Member";
  const rawNickname = metadata?.nickname;
  const trimmed = typeof rawNickname === "string" ? rawNickname.trim() : "";
  const nickname =
    trimmed.length > 0 &&
    trimmed.length <= NICKNAME_MAX_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(trimmed)
      ? trimmed
      : null;

  return { defaultName, nickname, name: nickname ?? defaultName };
}
