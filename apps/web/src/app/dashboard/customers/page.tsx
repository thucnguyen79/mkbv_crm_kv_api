'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Send } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatDateTime, formatVnd } from '@/lib/format';
import { CustomerDetailDrawer } from './detail-drawer';
import { SendMessageDialog } from './send-message-dialog';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  branchId: number | null;
  totalSpent: number;
  lastPurchaseAt: string | null;
  tier: string | null;
  points: number;
  createdAt: string;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const TIER_LABEL: Record<string, string> = {
  GUEST: 'Khách',
  MEMBER: 'Hội viên',
  SILVER: 'Bạc',
  TITAN: 'Titan',
  GOLD: 'Vàng',
  PLATINUM: 'Bạch kim',
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sendTo, setSendTo] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, tier, page }],
    queryFn: () =>
      getApiClient()
        .get<Paginated<Customer>>('/customers', {
          params: { search: search || undefined, tier: tier || undefined, page, pageSize: 20 },
        })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Khách hàng</h1>
        <div className="text-sm text-muted-foreground">
          Tổng {data?.meta.total ?? 0}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tên hoặc SĐT…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả hạng</option>
          {Object.entries(TIER_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>SĐT</TableHead>
              <TableHead>Hạng</TableHead>
              <TableHead className="text-right">Điểm</TableHead>
              <TableHead className="text-right">Chi tiêu</TableHead>
              <TableHead>Mua gần nhất</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data.length ? (
              data.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                  <TableCell>
                    {c.tier ? (
                      <Badge variant="secondary">{TIER_LABEL[c.tier] ?? c.tier}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">{c.points.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatVnd(c.totalSpent)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(c.lastPurchaseAt)}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(c.id)}>
                      Chi tiết
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSendTo({ id: c.id, name: c.name })}
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Không có khách hàng phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.meta.totalPages}
          </span>
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

      <CustomerDetailDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />
      <SendMessageDialog
        customerId={sendTo?.id ?? null}
        customerName={sendTo?.name ?? ''}
        onClose={() => setSendTo(null)}
      />
    </div>
  );
}
