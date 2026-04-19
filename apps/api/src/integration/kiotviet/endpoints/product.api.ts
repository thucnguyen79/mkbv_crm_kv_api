import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvProduct } from '../dto/kiotviet.dto';
import { KvListQuery, KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class ProductApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(
    query: KvListQuery = {},
    opts?: { signal?: AbortSignal },
  ): Promise<KvPaginatedResponse<KvProduct>> {
    return this.http.get(
      '/products',
      {
        orderBy: 'modifiedDate',
        orderDirection: 'ASC',
        pageSize: 100,
        includeRemoveIds: true,
        includeInventory: true, // cần cho ProductStock sync
        ...query,
      },
      opts,
    );
  }

  get(id: number, opts?: { signal?: AbortSignal }): Promise<KvProduct> {
    return this.http.get(`/products/${id}`, undefined, opts);
  }
}
