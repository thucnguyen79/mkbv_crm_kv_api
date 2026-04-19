import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvOrder } from '../dto/kiotviet.dto';
import { KvListQuery, KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class OrderApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(
    query: KvListQuery = {},
    opts?: { signal?: AbortSignal },
  ): Promise<KvPaginatedResponse<KvOrder>> {
    return this.http.get(
      '/orders',
      {
        orderBy: 'modifiedDate',
        orderDirection: 'ASC',
        pageSize: 100,
        includeOrderDetails: true,
        includeRemoveIds: true,
        ...query,
      },
      opts,
    );
  }

  get(id: number, opts?: { signal?: AbortSignal }): Promise<KvOrder> {
    return this.http.get(`/orders/${id}`, undefined, opts);
  }

  getByCode(code: string, opts?: { signal?: AbortSignal }): Promise<KvOrder> {
    return this.http.get(`/orders/code/${encodeURIComponent(code)}`, undefined, opts);
  }
}
