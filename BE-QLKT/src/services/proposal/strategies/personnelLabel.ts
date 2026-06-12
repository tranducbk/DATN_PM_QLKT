export function formatQuanNhanLabel(
  quanNhan: { ho_ten?: string | null } | null | undefined
): string {
  const name = quanNhan?.ho_ten?.trim();
  return name ? `Quân nhân ${name}` : 'Một quân nhân';
}
