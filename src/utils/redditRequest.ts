/** Use the same server relay in development and in the built application. */
export async function requestRedditJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Reddit relay did not return JSON. Start the API server and check the proxy configuration.');
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Reddit request failed (HTTP ${response.status})`);
  }
  return payload as T;
}
