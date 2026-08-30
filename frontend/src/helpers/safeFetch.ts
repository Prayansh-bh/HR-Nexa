/**
 * safeFetch.ts
 *
 * Single Responsibility: Wraps an async API call and returns its result or
 * `null` on failure, preventing one failed endpoint from silently aborting
 * the entire data-load chain.
 *
 * - Pure utility — no side effects, no React/DOM dependencies.
 * - Logs the endpoint name and error message for debuggability.
 * - Generic so it works with any return type.
 */

/**
 * Execute `fn` and return its resolved value.
 * On any error, log a warning and return `null`.
 *
 * @param label - Human-readable name for logging (e.g. "/departments").
 * @param fn    - Async function that performs the API call.
 */
export async function safeFetch<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[safeFetch] ${label} failed:`, message);
    return null;
  }
}
