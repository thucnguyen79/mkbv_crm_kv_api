import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvInvoice } from '../dto/kiotviet.dto';
import { KvListQuery, KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class InvoiceApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(
    query: KvListQuery = {},
    opts?: { signal?: AbortSignal },
  ): Promise<KvPaginatedResponse<KvInvoice>> {
    return this.http.get(
      '/invoices',
      {
        orderBy: 'modifiedDate',
        orderDirection: 'ASC',
        pageSize: 100,
        includeInvoiceDetails: true,
        includePayment: true,
        includeRemoveIds: true,
        ...query,
      },
      opts,
    );
  }

  get(id: number, opts?: { signal?: AbortSignal }): Promise<KvInvoice> {
    return this.http.get(`/invoices/${id}`, undefined, opts);
  }

  getByCode(code: string, opts?: { signal?: AbortSignal }): Promise<KvInvoice> {
    return this.http.get(`/invoices/code/${encodeURIComponent(code)}`, undefined, opts);
  }
}
