import { cancel, isCancel, select } from '@clack/prompts';

export async function selectMainAction(): Promise<'init' | 'run' | 'status' | 'doctor' | null> {
  const result = await select({
    message: 'Choose a Corydora action',
    options: [
      { value: 'run', label: 'Run scrub' },
      { value: 'status', label: 'Show status' },
      { value: 'doctor', label: 'Run doctor' },
      { value: 'init', label: 'Re-run init' },
    ],
  });

  if (isCancel(result)) {
    cancel('Cancelled.');
    return null;
  }

  return result;
}
