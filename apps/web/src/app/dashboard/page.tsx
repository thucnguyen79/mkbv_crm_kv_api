'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, ShoppingCart, Package, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';

interface SyncCursor {
  entity: string;
  status: string | null;
  lastRunAt: string | null;
  lastSyncedAt: string | null;
  note?: string | null;
}

interface Pagination<T> {
  data: T[];
  meta: { total: number };
}

interface BranchSummary {
  branchId: number;
  branchName: string;
  units: number;
  sellValue: number;
  costValue: number;
  belowMinCount: number;
  deadCount: number;
}

export default function DashboardHome() {
  const api = getApiClient();

  const customers = useQuery({
    queryKey: ['customers-count'],
    queryFn: () =>
      api.get<Pagination<unknown>>('/customers', { params: { pageSize: 1 } }).then((r) => r.data),
  });
  const orders = useQuery({
    queryKey: ['orders-count'],
    queryFn: () =>
      api.get<Pagination<unknown>>('/orders', { params: { pageSize: 1 } }).then((r) => r.data),
  });
  const products = useQuery({
    queryKey: ['products-count'],
    queryFn: () =>
      api.get<Pagination<unknown>>('/products', { params: { pageSize: 1 } }).then((r) => r.data),
  });
  const campaigns = useQuery({
    queryKey: ['campaigns-count'],
    queryFn: () =>
      api.get<Pagination<unknown>>('/campaigns', { params: { pageSize: 1 } }).then((r) => r.data),
  });

  const stockSummary = useQuery({
    queryKey: ['stock-summary'],
    queryFn: () => api.get<BranchSummary[]>('/stock/summary').then((r) => r.data),
  });

  const syncStatus = useQuery({
    queryKey: ['sync-status'],
    queryFn: () =>
      api.get<{ data: SyncCursor[] }>('/sync/status').then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tổng quan</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Khách hàng" icon={Users} value={customers.data?.meta.total} loading={customers.isLoading} />
        <Metric label="Đơn hàng" icon={ShoppingCart} value={orders.data?.meta.total} loading={orders.isLoading} />
        <Metric label="Sản phẩm" icon={Package} value={products.data?.meta.total} loading={products.isLoading} />
        <Metric label="Chiến dịch" icon={Megaphone} value={campaigns.data?.meta.total} loading={campaigns.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tồn kho theo chi nhánh</CardTitle>
          </CardHeader>
          <CardContent>
            {stockSummary.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-2">
                {stockSummary.data?.map((b) => (
                  <div key={b.branchId} className="flex items-center justify-between border-b py-2 last:border-b-0">
                    <div>
                      <div className="font-medium">{b.branchName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.units.toLocaleString()} đơn vị ·{' '}
                        {(b.sellValue / 1_000_000).toFixed(1)}M VND giá bán ·{' '}
                        {(b.costValue / 1_000_000).toFixed(1)}M VND giá vốn
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {b.belowMinCount > 0 && (
                        <Badge variant="warning">Thấp: {b.belowMinCount}</Badge>
                      )}
                      {b.deadCount > 0 && <Badge variant="destructive">Dead: {b.deadCount}</Badge>}
                    </div>
                  </div>
                ))}
                {stockSummary.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">Chưa có dữ liệu tồn kho.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync KiotViet</CardTitle>
          </CardHeader>
          <CardContent>
            {syncStatus.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-1">
                {syncStatus.data?.data.map((c) => (
                  <div key={c.entity} className="flex items-center justify-between border-b py-1.5 last:border-b-0">
                    <div className="font-mono text-sm">{c.entity}</div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-muted-foreground">
                        {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString('vi-VN') : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-semibold">{value?.toLocaleString() ?? '—'}</div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'success') return <Badge variant="success">success</Badge>;
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>;
  if (status === 'running') return <Badge variant="warning">running</Badge>;
  return <Badge variant="outline">{status ?? '—'}</Badge>;
}
