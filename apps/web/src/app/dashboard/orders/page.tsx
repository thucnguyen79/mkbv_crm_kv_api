'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatDateTime, formatVnd } from '@/lib/format';

interface Order {
  id: number;
  externalCode: string;
  sourceType: 'ORDER' | 'INVOICE';
  customerName: string | null;
  totalAmount: number;
  discount: number;
  status: string;
  purchasedAt: string;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; totalPages: number };
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['orders', page],
    queryFn: () =>
      getApiClient()
        .get<Paginated<Order>>('/orders', { params: { page, pageSize: 20 } })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Đơn hàng</h1>
        <div className="text-sm text-muted-foreground">Tổng {data?.meta.total ?? 0}</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày mua</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              data?.data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.externalCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.sourceType}</Badge>
                  </TableCell>
                  <TableCell>{o.customerName ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatVnd(o.totalAmount)}</TableCell>
                  <TableCell className="text-xs">{o.status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(o.purchasedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </Button>
          <span className="text-sm">{page} / {data.meta.totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
