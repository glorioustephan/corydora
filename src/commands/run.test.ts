import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultConfig } from '../config/schema.js';
import type { Ui } from '../ui/output.js';

const {
  loadRequiredConfig,
  listAgents,
  supportsTmux,
  launchBackgroundRun,
  runCorydoraSession,
  detectProjectFingerprint,
} = vi.hoisted(() => ({
  loadRequiredConfig: vi.fn(),
  listAgents: vi.fn(),
  supportsTmux: vi.fn(),
  launchBackgroundRun: vi.fn(),
  runCorydoraSession: vi.fn(),
  detectProjectFingerprint: vi.fn(),
}));

vi.mock('./helpers.js', () => ({
  loadRequiredConfig,
}));

vi.mock('../agents/catalog.js', () => ({
  listAgents,
}));

vi.mock('../filesystem/project.js', () => ({
  detectProjectFingerprint,
}));

vi.mock('../runtime/tmux.js', () => ({
  launchBackgroundRun,
  supportsTmux,
}));

vi.mock('../runtime/run-session.js', () => ({
  runCorydoraSession,
}));

import { runRunCommand } from './run.js';

function createUi(): Ui {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    printJson: vi.fn(),
  };
}

describe('runRunCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    detectProjectFingerprint.mockReturnValue({
      packageManager: 'pnpm',
      frameworks: ['node'],
      techLenses: ['typescript', 'refactoring', 'node-cli'],
      packageCount: 1,
      topLevelDirectories: ['src'],
    });
    listAgents.mockResolvedValue([]);
    runCorydoraSession.mockResolvedValue({
      runId: 'run-123',
      status: 'completed',
      provider: 'fake',
      isolationMode: 'current-branch',
      effectiveIsolationMode: 'current-branch',
      mode: 'auto',
      selectedAgentIds: [],
    });
  });

  it('honors backgroundByDefault when foreground is not forced', async () => {
    const config = getDefaultConfig({
      provider: 'fake',
      selectedBuiltinAgents: ['bug-investigator'],
      backgroundByDefault: true,
    });
    loadRequiredConfig.mockResolvedValue(config);
    supportsTmux.mockReturnValue(true);
    launchBackgroundRun.mockReturnValue({ keepAwake: true });
    const ui = createUi();

    await runRunCommand(
      {
        projectRoot: '/tmp/project',
        json: true,
      },
      ui,
    );

    expect(launchBackgroundRun).toHaveBeenCalledWith(
      expect.stringMatching(/^corydora-project-/),
      [
        'run',
        '--foreground',
        '--session-name',
        expect.stringMatching(/^corydora-project-/),
        '--mode',
        'auto',
      ],
      '/tmp/project',
      true,
    );
    expect(runCorydoraSession).not.toHaveBeenCalled();
    expect(ui.printJson).toHaveBeenCalledWith(
      expect.objectContaining({
        background: true,
        keepAwake: true,
      }),
    );
  });
});
