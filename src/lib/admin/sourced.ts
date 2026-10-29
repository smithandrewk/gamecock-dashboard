// Every admin block is Sourced: either data with where and when it came from, or the
// error. A failed query renders its error, never a confident 0.
export type Sourced<T> = { ok: true; data: T; source: string; at: string } | { ok: false; error: string; source: string };

export async function sourced<T>(source: string, fn: () => Promise<T>): Promise<Sourced<T>> {
  try {
    return { ok: true, data: await fn(), source, at: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), source };
  }
}
