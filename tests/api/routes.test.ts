// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: null as null | { id: string } }));

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authState.user } })),
    },
  })),
  createSupabaseAdmin: vi.fn(),
}));

import { POST as chatPost } from '@/app/api/chat/route';
import { GET as presetsGet, POST as presetsPost } from '@/app/api/profile/presets/route';
import { GET as pubmedGet } from '@/app/api/pubmed/route';
import { GET as chemblGet } from '@/app/api/chembl/route';
import { GET as openFdaGet } from '@/app/api/openfda/route';

beforeEach(() => {
  authState.user = null;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unauthenticated profile and chat behavior', () => {
  it('returns 401 from chat before using any external service', async () => {
    const response = await chatPost(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 from profile preset read and write routes', async () => {
    const getResponse = await presetsGet();
    const postResponse = await presetsPost(new Request('http://localhost/api/profile/presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', drugs: {} }),
    }) as never);
    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
  });
});

describe('input and configuration validation', () => {
  it('returns the current missing-key response before chat input parsing', async () => {
    authState.user = { id: 'test-user' };
    const response = await chatPost(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'ANTHROPIC_API_KEY not configured' });
  });

  it('rejects invalid chat input without calling Anthropic', async () => {
    authState.user = { id: 'test-user' };
    process.env.ANTHROPIC_API_KEY = 'test-only-key';
    const response = await chatPost(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid input');
  });

  it('rejects an empty preset name for an authenticated user', async () => {
    authState.user = { id: 'test-user' };
    const response = await presetsPost(new Request('http://localhost/api/profile/presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '   ', drugs: { sertraline: 100 } }),
    }) as never);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Name is required' });
  });
});

describe('safe external-service failure behavior', () => {
  it.each([
    ['PubMed', pubmedGet, 'http://localhost/api/pubmed?q=sertraline', 'PubMed fetch failed'],
    ['ChEMBL', chemblGet, 'http://localhost/api/chembl?drug=sertraline', 'ChEMBL fetch failed'],
    ['OpenFDA', openFdaGet, 'http://localhost/api/openfda?drug=sertraline', 'OpenFDA fetch failed'],
  ])('%s returns a stable 500 envelope when fetch rejects', async (_name, handler, url, message) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline test double')));
    const response = await handler(new Request(url));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: message });
  });
});
