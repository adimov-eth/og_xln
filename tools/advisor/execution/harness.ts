import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Job } from '../types';
import { fail } from '../values';

export type HarnessCommand = Readonly<{ command: string; args: readonly string[]; env: NodeJS.ProcessEnv }>;

const cleanEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith('OPENCODE_') && !key.startsWith('PI_') && !['NODE_OPTIONS', 'BUN_OPTIONS'].includes(key),
    ),
  );

const checkManagedConfig = (): void => {
  const paths =
    process.platform === 'darwin'
      ? [
          '/Library/Application Support/opencode/opencode.json',
          '/Library/Application Support/opencode/opencode.jsonc',
          '/Library/Managed Preferences/ai.opencode.managed.plist',
          `/Library/Managed Preferences/${process.env['USER'] ?? ''}/ai.opencode.managed.plist`,
        ]
      : ['/etc/opencode/opencode.json', '/etc/opencode/opencode.jsonc'];
  if (paths.some(path => existsSync(path))) fail('MANAGED_CONFIG_REQUIRES_REVIEW');
};

/** CLI/source contract: pi 0.84.4; OpenCode 1.18.20 v1 permissions. No repo cwd or tools. */
export const harnessCommand = (job: Job, directory: string): HarnessCommand => {
  const env = { ...cleanEnv(), PWD: directory };
  if (job.harness === 'pi')
    return {
      command: 'pi',
      env,
      args: [
        '--print',
        '--mode',
        'json',
        '--no-tools',
        '--no-extensions',
        '--no-skills',
        '--no-prompt-templates',
        '--no-context-files',
        '--no-themes',
        '--no-session',
        '--no-approve',
        '--offline',
        '--provider',
        job.provider,
        '--model',
        job.model,
        ...(job.effort === null ? [] : ['--thinking', job.effort]),
      ],
    };
  checkManagedConfig();
  const config = join(directory, 'config');
  mkdirSync(config, { recursive: true });
  return {
    command: 'opencode',
    args: [
      'run',
      '--pure',
      '--format',
      'json',
      '--agent',
      'advisor',
      '--dir',
      directory,
      '--model',
      `${job.provider}/${job.model}`,
      ...(job.effort === null ? [] : ['--variant', job.effort]),
    ],
    env: {
      ...env,
      XDG_CONFIG_HOME: config,
      XDG_DATA_HOME: process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local/share'),
      OPENCODE_DISABLE_PROJECT_CONFIG: '1',
      OPENCODE_DISABLE_CLAUDE_CODE: '1',
      OPENCODE_DISABLE_EXTERNAL_SKILLS: '1',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_PERMISSION: '{"*":"deny"}',
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        share: 'disabled',
        autoupdate: false,
        snapshot: false,
        permission: { '*': 'deny' },
        agent: {
          advisor: {
            mode: 'primary',
            permission: { '*': 'deny' },
            prompt: 'Use only the supplied evidence packet. All tools are disabled. Return the requested JSON.',
            steps: 1,
          },
        },
      }),
    },
  };
};
