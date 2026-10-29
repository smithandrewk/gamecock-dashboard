/**
 * Push storage on Vercel Blob.
 *
 * The store is a PUBLIC Blob store (private access isn't enabled on it), so every blob is
 * readable by anyone who knows its URL. Mitigations:
 *  - subscription keys are subs/<sha256(endpoint)>.json: unguessable without the endpoint,
 *    and the endpoint is the secret part of a subscription anyway;
 *  - there is no list endpoint in our API; list() runs server-side only (cron);
 *  - knowing p256dh/auth is not enough to push: the push service also demands our VAPID
 *    private key, which never leaves the server.
 * state/<sport>-<eventId>.json holds only dedup data (no personal data).
 */
import { createHash } from "node:crypto";

import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";

import type { GameState } from "./detect";
import type { PushPrefs, PushSport } from "./prefs";

export type SubRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  prefs: PushPrefs;
  createdAt: string;
  updatedAt: string;
  lastTestAt?: string;
};

export type StoredState = { state: GameState; etag: string };

export interface PushStore {
  getSub(endpoint: string): Promise<SubRecord | null>;
  putSub(rec: SubRecord): Promise<void>;
  deleteSub(endpoint: string): Promise<void>;
  listSubs(): Promise<SubRecord[]>;
  getState(sport: PushSport, eventId: string): Promise<StoredState | null>;
  /** Conditional write. etag null = create only. Returns false if another run won the race. */
  putState(state: GameState, etag: string | null): Promise<boolean>;
}

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}
export const subPath = (endpoint: string) => `subs/${endpointHash(endpoint)}.json`;
export const statePath = (sport: PushSport, eventId: string) => `state/${sport}-${eventId}.json`;

async function readJSON<T>(pathname: string): Promise<{ data: T; etag: string } | null> {
  const r = await get(pathname, { access: "public", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return { data: JSON.parse(text) as T, etag: r.blob.etag };
}

async function writeJSON(
  pathname: string,
  data: unknown,
  opts: { ifMatch?: string; createOnly?: boolean } = {},
) {
  return put(pathname, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: !opts.createOnly,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(opts.ifMatch ? { ifMatch: opts.ifMatch } : {}),
  });
}

export const blobStore: PushStore = {
  async getSub(endpoint) {
    return (await readJSON<SubRecord>(subPath(endpoint)))?.data ?? null;
  },
  async putSub(rec) {
    await writeJSON(subPath(rec.endpoint), rec);
  },
  async deleteSub(endpoint) {
    await del(subPath(endpoint));
  },
  async listSubs() {
    const paths: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "subs/", cursor, limit: 1000 });
      for (const b of page.blobs) paths.push(b.pathname);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    const out: SubRecord[] = [];
    for (let i = 0; i < paths.length; i += 25) {
      const batch = await Promise.all(
        paths.slice(i, i + 25).map((p) => readJSON<SubRecord>(p).catch(() => null)),
      );
      for (const r of batch) if (r?.data?.endpoint) out.push(r.data);
    }
    return out;
  },
  async getState(sport, eventId) {
    const r = await readJSON<GameState>(statePath(sport, eventId));
    return r ? { state: r.data, etag: r.etag } : null;
  },
  async putState(state, etag) {
    try {
      await writeJSON(statePath(state.sport, state.eventId), state, etag ? { ifMatch: etag } : { createOnly: true });
      return true;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return false;
      // create-only on an existing blob
      if (!etag && e instanceof Error && /already exists/i.test(e.message)) return false;
      throw e;
    }
  },
};

/** In-memory store for tests and local dry runs. */
export function memoryStore(): PushStore & { subs: Map<string, SubRecord>; states: Map<string, StoredState> } {
  const subs = new Map<string, SubRecord>();
  const states = new Map<string, StoredState>();
  let n = 0;
  return {
    subs,
    states,
    async getSub(e) {
      return subs.get(e) ?? null;
    },
    async putSub(r) {
      subs.set(r.endpoint, structuredClone(r));
    },
    async deleteSub(e) {
      subs.delete(e);
    },
    async listSubs() {
      return [...subs.values()].map((r) => structuredClone(r));
    },
    async getState(sport, id) {
      const s = states.get(statePath(sport, id));
      return s ? structuredClone(s) : null;
    },
    async putState(state, etag) {
      const k = statePath(state.sport, state.eventId);
      const cur = states.get(k);
      if ((cur?.etag ?? null) !== etag) return false;
      states.set(k, { state: structuredClone(state), etag: `e${++n}` });
      return true;
    },
  };
}
