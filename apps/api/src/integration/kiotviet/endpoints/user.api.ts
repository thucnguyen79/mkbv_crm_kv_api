import { Injectable } from '@nestjs/common';
import { KiotVietHttpService } from '../kiotviet-http.service';
import { KvUser } from '../dto/kiotviet.dto';
import { KvPaginatedResponse } from '../dto/paginated-kv.dto';

@Injectable()
export class UserApi {
  constructor(private readonly http: KiotVietHttpService) {}

  list(opts?: { signal?: AbortSignal }): Promise<KvPaginatedResponse<KvUser>> {
    return this.http.get('/users', { pageSize: 100 }, opts);
  }
}
