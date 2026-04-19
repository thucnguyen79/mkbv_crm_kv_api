import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvBranch } from '../dto/kiotviet.dto';
import { KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class BranchApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(opts?: { signal?: AbortSignal }): Promise<KvPaginatedResponse<KvBranch>> {
    return this.http.get('/branches', { pageSize: 100 }, opts);
  }
}
