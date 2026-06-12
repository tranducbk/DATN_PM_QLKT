export function formatPersonnelLabel(
  personnel: { ho_ten?: string | null } | null | undefined
): string {
  const name = personnel?.ho_ten?.trim();
  return name ? `Quân nhân ${name}` : 'Một quân nhân';
}
