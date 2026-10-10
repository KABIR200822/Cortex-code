export function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fromMeta = meta.full_name || meta.name;
  if (fromMeta && fromMeta.trim()) return fromMeta.trim();
  const email = user.email ?? "";
  const local = email.split("@")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "User";
}
