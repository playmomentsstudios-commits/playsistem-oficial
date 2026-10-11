export function reconciliationAssociationPatch(
  metadata: Record<string, unknown>,
  existingProjectId: string,
  targetProjectId: string,
): Record<string, unknown> {
  const { stage_id: discoveredStageId, ...driveMetadata } = metadata;
  if (existingProjectId === targetProjectId) return driveMetadata;

  return {
    ...driveMetadata,
    stage_id: discoveredStageId ?? null,
    task_id: null,
  };
}
