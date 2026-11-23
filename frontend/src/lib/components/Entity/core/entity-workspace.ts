import { normalizeId } from '../../../utils/primitives';

export const runtimeProjectionMatchesRuntime = (
  projectionRuntimeId: string | null | undefined,
  selectedRuntimeId: string | null | undefined,
): boolean => {
  const projection = normalizeId(projectionRuntimeId);
  const selected = normalizeId(selectedRuntimeId);
  return projection.length > 0 && selected.length > 0 && projection === selected;
};
