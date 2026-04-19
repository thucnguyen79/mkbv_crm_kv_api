export const ORDER_SYNCED_EVENT = 'order.synced';

export class OrderSyncedEvent {
  constructor(public readonly customerIds: number[]) {}
}
