import type { Harness, Job } from './types';
import { choice, exact, fail, object, string } from './values';

export type Response = Readonly<{ text: string; costUsd: number | null }>;
const entries = (output: string): readonly Record<string, unknown>[] =>
  output
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => object(JSON.parse(line)));

const validateAnswer = (text: string): string => {
  const answer = exact(JSON.parse(text), ['verdict', 'answer', 'references']);
  choice(answer['verdict'], ['ANSWER', 'PASS', 'BLOCK', 'UNVERIFIED']);
  string(answer['answer'], 900_000);
  const refs = answer['references'];
  if (!Array.isArray(refs) || refs.length > 100) return fail('ANSWER_REFERENCES_INVALID');
  refs.forEach(ref => string(ref, 1000));
  return text;
};

const reportedCost = (value: unknown): number | null => {
  if (value === undefined) return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fail('USAGE_COST_INVALID');
};

const piResponse = (rows: readonly Record<string, unknown>[], job: Job): Response => {
  const messages = rows
    .filter(row => row['type'] === 'message_end')
    .map(row => object(row['message']))
    .filter(message => message['role'] === 'assistant');
  if (messages.length !== 1 || !rows.some(row => row['type'] === 'agent_end')) return fail('FINAL_MESSAGE_MISSING');
  const message = messages[0];
  if (!message || message['stopReason'] !== 'stop') return fail('FINAL_MESSAGE_INCOMPLETE');
  if (message['model'] !== job.model || message['provider'] !== job.provider) return fail('RESPONSE_MODEL_MISMATCH');
  const content = message['content'];
  if (!Array.isArray(content)) return fail('FINAL_CONTENT_INVALID');
  const parts = content.map(object);
  if (parts.some(part => part['type'] === 'toolCall')) return fail('UNEXPECTED_TOOL_CALL');
  const text = parts
    .filter(part => part['type'] === 'text')
    .map(part => string(part['text'], 1_000_000))
    .join('\n');
  const usage = object(message['usage']);
  const cost = usage['cost'] === undefined ? null : reportedCost(object(usage['cost'])['total']);
  return { text: validateAnswer(text), costUsd: cost };
};

const opencodeResponse = (rows: readonly Record<string, unknown>[]): Response => {
  if (rows.some(row => row['type'] === 'error' || row['type'] === 'tool_use'))
    return fail('HARNESS_ERROR_OR_TOOL_CALL');
  const finishes = rows.filter(row => row['type'] === 'step_finish').map(row => object(row['part']));
  if (finishes.length !== 1 || finishes[0]?.['reason'] !== 'stop') return fail('FINAL_MESSAGE_INCOMPLETE');
  const text = rows
    .filter(row => row['type'] === 'text')
    .map(row => string(object(row['part'])['text'], 1_000_000))
    .join('\n');
  return { text: validateAnswer(text), costUsd: reportedCost(finishes[0]['cost']) };
};

export const parseOutput = (harness: Harness, output: string, job: Job): Response => {
  const rows = entries(output);
  return harness === 'pi' ? piResponse(rows, job) : opencodeResponse(rows);
};
