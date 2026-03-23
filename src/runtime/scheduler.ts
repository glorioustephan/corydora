import { groupFilesForScheduling } from '../filesystem/discovery.js';
import type { SchedulerState } from '../types/domain.js';

export function restoreSchedulerState(
  existing: SchedulerState | undefined,
  files: string[]
): SchedulerState {
  const grouped = groupFilesForScheduling(files);
  const groups = Object.keys(grouped).sort((left, right) => left.localeCompare(right));

  if (!existing) {
    return {
      groupOrder: groups,
      groupCursors: Object.fromEntries(groups.map(group => [group, 0])),
      completedFiles: [],
      failedFiles: [],
    };
  }

  return {
    groupOrder: [...new Set([...existing.groupOrder.filter(group => groups.includes(group)), ...groups])],
    groupCursors: Object.fromEntries(
      groups.map(group => [group, Math.max(0, existing.groupCursors[group] ?? 0)])
    ),
    completedFiles: [...new Set(existing.completedFiles)],
    failedFiles: [...new Set(existing.failedFiles)],
  };
}

export function selectScanBatch(
  state: SchedulerState,
  files: string[],
  batchSize: number
): string[] {
  const grouped = groupFilesForScheduling(files);
  const selected: string[] = [];
  const completed = new Set(state.completedFiles);
  const failed = new Set(state.failedFiles);

  for (let pass = 0; pass < batchSize; pass++) {
    let pickedAny = false;

    for (const group of state.groupOrder) {
      const groupFiles = grouped[group] ?? [];
      for (let index = state.groupCursors[group] ?? 0; index < groupFiles.length; index++) {
        const file = groupFiles[index];
        if (!file || completed.has(file) || failed.has(file) || selected.includes(file)) {
          continue;
        }

        selected.push(file);
        pickedAny = true;
        break;
      }

      if (selected.length >= batchSize) {
        return selected;
      }
    }

    if (!pickedAny) {
      break;
    }
  }

  return selected;
}

export function noteFileProcessed(
  state: SchedulerState,
  file: string,
  success: boolean
): SchedulerState {
  const grouped = groupFilesForScheduling([file]);
  const group = Object.keys(grouped)[0] ?? '.';

  return {
    ...state,
    groupCursors: {
      ...state.groupCursors,
      [group]: (state.groupCursors[group] ?? 0) + 1,
    },
    completedFiles: success
      ? [...new Set([...state.completedFiles, file])]
      : state.completedFiles,
    failedFiles: success ? state.failedFiles : [...new Set([...state.failedFiles, file])],
  };
}
