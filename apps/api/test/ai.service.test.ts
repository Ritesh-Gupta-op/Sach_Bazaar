import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AiService } from '../src/ai/ai.service';

const realFetch = global.fetch;

async function withFetch<T>(stub: typeof fetch, fn: () => Promise<T>): Promise<T> {
  global.fetch = stub;
  try {
    return await fn();
  } finally {
    global.fetch = realFetch;
  }
}

describe('AiService', () => {
  it('forwards the photo upstream and returns the advisory result', async () => {
    let sawMultipart = false;
    const service = new AiService();
    const result = await withFetch(
      (async (_url: unknown, init?: RequestInit) => {
        sawMultipart = init?.body instanceof FormData;
        return new Response(JSON.stringify({ score: 0.42, explanation: 'fair band', modelVersion: 'baseline-mock-0.2' }), { status: 200 });
      }) as typeof fetch,
      () => service.grade(Buffer.from('photo-bytes').toString('base64')),
    );
    assert.equal(sawMultipart, true);
    assert.equal(result.score, 0.42);
  });

  it('returns a clear 502 when the service is unreachable', async () => {
    const service = new AiService();
    await withFetch(
      (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
      async () => {
        await assert.rejects(service.grade(Buffer.from('x').toString('base64')), BadGatewayException);
      },
    );
  });

  it('rejects empty and non-decoding bodies with 400s', async () => {
    const service = new AiService();
    await assert.rejects(service.grade(''), BadRequestException);
    await assert.rejects(service.grade('!!!!'), BadRequestException);
  });
});
