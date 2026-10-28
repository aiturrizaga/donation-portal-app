/** juan.perez@gmail.com → jua***@gmail.com — para mostrar a dónde se envió un código. */
export function maskEmail(email: string): string {
  const [user, domain] = email.trim().split('@');
  if (!user || !domain) return email;
  const visible = user.slice(0, Math.min(3, Math.max(1, user.length - 1)));
  return `${visible}***@${domain}`;
}
