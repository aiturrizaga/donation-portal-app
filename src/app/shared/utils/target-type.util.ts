// Mirrors the admin's target type labels (donation-manager-app's
// shared/utils/target-type.util.ts) — kept as a separate copy since each
// frontend has its own shared/utils and no shared package between them.
const TARGET_TYPE_LABELS: Record<string, string> = {
  cause: 'Causa',
  group: 'Labor',
  campaign: 'Campaña',
  goal: 'Meta',
};

export function getTargetTypeLabel(type: string): string {
  return TARGET_TYPE_LABELS[type] ?? type;
}
