export interface SyncResult {
  entity: string;
  synced: number;
  skipped?: number;
  lastSyncedAt: Date;
}

export interface SyncStrategy {
  /** Unique short identifier matching SyncCursor.entity. */
  readonly entity: string;
  /**
   * Run an incremental sync (pulls records modified since last cursor).
   * Signal được check giữa các page → abort trả về `SyncCancelledError`.
   */
  run(signal?: AbortSignal): Promise<SyncResult>;
}

export class SyncCancelledError extends Error {
  readonly isCancellation = true;
  constructor() {
    super('Sync cancelled by user');
    this.name = 'SyncCancelledError';
  }
}

export const SYNC_STRATEGY = Symbol('SYNC_STRATEGY');
