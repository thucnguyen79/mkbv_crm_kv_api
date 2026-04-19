import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvCustomer } from '../dto/kiotviet.dto';
import { KvListQuery, KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class CustomerApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(
    query: KvListQuery = {},
    opts?: { signal?: AbortSignal },
  ): Promise<KvPaginatedResponse<KvCustomer>> {
    return this.http.get(
      '/customers',
      {
        orderBy: 'modifiedDate',
        orderDirection: 'ASC',
        pageSize: 100,
        includeRemoveIds: true,
        ...query,
      },
      opts,
    );
  }

  get(id: number, opts?: { signal?: AbortSignal }): Promise<KvCustomer> {
    return this.http.get(`/customers/${id}`, undefined, opts);
  }

  getByCode(code: string, opts?: { signal?: AbortSignal }): Promise<KvCustomer> {
    return this.http.get(`/customers/code/${encodeURIComponent(code)}`, undefined, opts);
  }

  create(body: Partial<KvCustomer>, opts?: { signal?: AbortSignal }): Promise<KvCustomer> {
    return this.http.post('/customers', body, opts);
  }

  update(
    id: number,
    body: Partial<KvCustomer>,
    opts?: { signal?: AbortSignal },
  ): Promise<KvCustomer> {
    return this.http.put(`/customers/${id}`, body, opts);
  }
}
