import { describe, expect, it } from 'vitest';
import { isRenderRuntime, SERVER_BIND_ADDRESS } from './runtime';

describe('server runtime', () => {
  it('binds the public HTTP server on every interface', () => {
    expect(SERVER_BIND_ADDRESS).toBe('0.0.0.0');
  });

  it('trusts the Render proxy marker only when Render provides it', () => {
    expect(isRenderRuntime({ RENDER: 'true' })).toBe(true);
    expect(isRenderRuntime({ RENDER: 'false' })).toBe(false);
    expect(isRenderRuntime({})).toBe(false);
  });
});
