export interface KvPaginatedResponse<T> {
  total: number;
  pageSize: number;
  data: T[];
  timestamp?: string;
  currentItem?: number;
  removedIds?: number[];
}

export interface KvListQuery {
  currentItem?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  lastModifiedFrom?: string; // ISO
  includeRemoveIds?: boolean;
}
