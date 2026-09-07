import type { Job } from '../types';
import { AdvisorError, object } from '../values';

/** Pi accepts fuzzy --model values; require an exact authenticated catalog row before any paid request. */
export const exactPiModel = (output: string, job: Job): boolean =>
  output.split('\n').some(line => {
    const columns = line.trim().split(/\s+/);
    return columns.length === 6 && columns[0] === job.provider && columns[1] === job.model;
  });

/** Validate effective settings, not merely our proposed override, before using OpenCode. */
export const isolatedOpenCode = (output: string): boolean => {
  const config = object(JSON.parse(output));
  const agents = object(config['agent']);
  const advisor = object(agents['advisor']);
  const deniesAll = (value: unknown): boolean => {
    const rules = object(value);
    return Object.keys(rules).length === 1 && rules['*'] === 'deny';
  };
  const emptyObject = (value: unknown): boolean => value === undefined || Object.keys(object(value)).length === 0;
  const emptyArray = (value: unknown): boolean => value === undefined || (Array.isArray(value) && value.length === 0);
  return (
    deniesAll(config['permission']) &&
    deniesAll(advisor['permission']) &&
    advisor['mode'] === 'primary' &&
    emptyObject(config['mcp']) &&
    emptyArray(config['plugin']) &&
    emptyArray(config['instructions']) &&
    config['share'] === 'disabled'
  );
};

export const validatePreflight = (output: string, job: Job): boolean => {
  try {
    return job.harness === 'pi' ? exactPiModel(output, job) : isolatedOpenCode(output);
  } catch (error) {
    if (!(error instanceof AdvisorError || error instanceof SyntaxError)) throw error;
    return false;
  }
};

export const preflightArgs = (job: Job): readonly string[] =>
  job.harness === 'opencode'
    ? ['debug', 'config', '--pure']
    : [
        '--list-models',
        job.model,
        '--offline',
        '--no-tools',
        '--no-extensions',
        '--no-skills',
        '--no-context-files',
        '--no-prompt-templates',
        '--no-themes',
        '--no-session',
        '--no-approve',
      ];
