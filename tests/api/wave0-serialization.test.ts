// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: { id: 'wave0-user' } as null | { id: string } }));
const databaseState = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; payload: Record<string, unknown> }> }));
const aiState = vi.hoisted(() => ({ lookup: 'sertraline', calls: [] as Record<string, unknown>[] }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = {
      create: vi.fn(async (args: Record<string, unknown>) => {
        aiState.calls.push(args);
        if (aiState.calls.length % 2 === 1) {
          return {
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', id: 'wave0-tool', name: 'lookup_drug_ki', input: { drug_name: aiState.lookup } }],
            usage: { input_tokens: 1, output_tokens: 1 },
          };
        }
        return {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'wave0 response' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      }),
    };
  },
}));

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authState.user } })) },
    from: vi.fn((table: string) => ({
      insert: vi.fn((payload: Record<string, unknown>) => {
        databaseState.inserts.push({ table, payload });
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: 'wave0-row', ...payload }, error: null })),
          })),
        };
      }),
    })),
  })),
  createSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      insert: vi.fn(async (payload: Record<string, unknown>) => {
        databaseState.inserts.push({ table, payload });
        return { error: null };
      }),
    })),
  })),
}));

import { POST as chatPost } from '@/app/api/chat/route';
import { POST as schemePost } from '@/app/api/scheme/route';
import { POST as presetsPost } from '@/app/api/profile/presets/route';
import { POST as treatmentPost } from '@/app/api/profile/treatment/route';

const CHARACTERIZATION_WARNING = 'CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION';

beforeEach(() => {
  authState.user = { id: 'wave0-user' };
  databaseState.inserts = [];
  aiState.lookup = 'sertraline';
  aiState.calls = [];
  process.env.ANTHROPIC_API_KEY = 'wave0-test-only-key';
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

async function invokeLookup(alias: string, activeScheme: Record<string, number> = { sertraline: 100 }) {
  aiState.lookup = alias;
  const response = await chatPost(new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'lookup',
      activeScheme,
      deficits: [{ title: 'wave0 deficit' }],
      zoneContext: 'dlPFC',
    }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ response: 'wave0 response' });
  expect(aiState.calls).toHaveLength(2);
  const secondCall = aiState.calls[1] as { messages: Array<{ content: unknown }> };
  const toolResults = secondCall.messages[2].content as Array<{ type: string; tool_use_id: string; content: string }>;
  return {
    firstCall: aiState.calls[0] as { system: string },
    toolResult: JSON.parse(toolResults[0].content) as Record<string, unknown>,
  };
}

describe('Wave 0 AI context characterization', () => {
  it.each(['sertraline', 'Золофт', 'СЕРТ'])('freezes key/name/short-code alias lookup for %s', async (alias) => {
    const { toolResult } = await invokeLookup(alias);
    expect(toolResult).toEqual({
      id: 'sertraline',
      name: 'Золофт',
      shortCode: 'СЕРТ',
      ki: { SERT: 0.29, DAT: 25, NET: 420, s1: 35 },
      sigma1Type: 'inv',
      doses: [25, 50, 75, 100, 150, 200],
      unit: 'мг',
    });
  });

  it('freezes the missing-drug tool result', async () => {
    const { toolResult } = await invokeLookup('not-a-current-drug');
    expect(toolResult).toEqual({ error: 'Drug "not-a-current-drug" not found in CortexMD database' });
  });

  it('freezes active-scheme, deficit, and zone serialization in the system prompt', async () => {
    const { firstCall } = await invokeLookup('sertraline', { ketamine: 0.5, vitamin_d: 2000 });
    expect(firstCall.system).toContain('Активная схема: {"ketamine":0.5,"vitamin_d":2000}');
    expect(firstCall.system).toContain('Дефициты: ["wave0 deficit"]');
    expect(firstCall.system).toContain('Вопрос о зоне мозга: dlPFC');
    expect(firstCall.system).not.toContain('dose_unit');
    expect(firstCall.system).not.toContain('schemaVersion');
  });
});

describe('Wave 0 API/persistence serialization characterization', () => {
  it('freezes the placeholder scheme endpoint echoing an unversioned numeric map', async () => {
    const payload = { scheme: { sertraline: 100, ketamine: 0.5 } };
    const response = await schemePost(new Request('http://localhost/api/scheme', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: 'Placeholder: scheme received but not persisted',
      received: payload,
    });
  });

  it('freezes user_presets.drugs as an unversioned numeric drug map', async () => {
    const response = await presetsPost(new Request('http://localhost/api/profile/presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  Wave 0  ', drugs: { vitamin_d: 2000, auvelity: 1 } }),
    }) as never);
    expect(response.status).toBe(200);
    expect(databaseState.inserts.find(({ table }) => table === 'user_presets')).toEqual({
      table: 'user_presets',
      payload: { user_id: 'wave0-user', name: 'Wave 0', drugs: { vitamin_d: 2000, auvelity: 1 } },
    });
    expect(databaseState.inserts.find(({ table }) => table === 'user_presets')?.payload).not.toHaveProperty('version');
  });

  it('freezes user_treatment_history coercion into dose_mg without unit/version', async () => {
    const response = await treatmentPost(new Request('http://localhost/api/profile/treatment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ drug_id: 'ketamine', dose_mg: '0.5', started_at: '2026-09-06' }),
    }) as never);
    expect(response.status).toBe(200);
    const insert = databaseState.inserts.find(({ table }) => table === 'user_treatment_history');
    expect(insert).toEqual({
      table: 'user_treatment_history',
      payload: {
        user_id: 'wave0-user', drug_id: 'ketamine', dose_mg: 0.5, started_at: '2026-09-06',
        ended_at: null, reason_for_change: null, effectiveness: null, side_effects: null,
      },
    });
    expect(insert?.payload).not.toHaveProperty('dose_unit');
    expect(insert?.payload).not.toHaveProperty('version');
  });

  it('keeps this API suite explicitly non-validating', () => {
    expect(CHARACTERIZATION_WARNING).toContain('NOT SCIENTIFIC VALIDATION');
  });
});
