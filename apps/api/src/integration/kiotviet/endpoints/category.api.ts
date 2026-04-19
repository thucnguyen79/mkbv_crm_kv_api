import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvCategory } from '../dto/kiotviet.dto';
import { KvListQuery, KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class CategoryApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(
    query: KvListQuery = {},
    opts?: { signal?: AbortSignal },
  ): Promise<KvPaginatedResponse<KvCategory>> {
    return this.http.get(
      '/categories',
      {
        orderBy: 'modifiedDate',
        orderDirection: 'ASC',
        pageSize: 100,
        hierachicalData: true,
        ...query,
      },
      opts,
    );
  }
}
