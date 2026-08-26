export const SERVER_BIND_ADDRESS = '0.0.0.0' as const;

/** Render provides this marker when the process runs behind its proxy. */
export function isRenderRuntime(
  values: Record<string, unknown> = process.env,
): boolean {
  return values.RENDER === 'true';
}
