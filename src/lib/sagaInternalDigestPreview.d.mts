export interface SagaAdminEvent {
  id: string
  event_type: string
  source_table: string
  title: string
  message: string
  created_at: string
}
export const SAGA_ADMIN_ZONE: string
export const SAGA_ADMIN_SLOTS: readonly number[]
export function sagaZonedParts(value: Date | string): { day: string; minute: number }
export function buildSagaInternalPreview(args: {
 events: SagaAdminEvent[]
 day: string
 slot: number
 now: Date | string
}): {
 key: string; label: string; count: number; omitted: number;
 title: string; lines: string[]
}
