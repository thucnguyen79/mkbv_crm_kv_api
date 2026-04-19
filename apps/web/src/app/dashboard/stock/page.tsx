'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatVnd } from '@/lib/format';

interface StockRow {
  productId: number;
  productCode: string;
  productName: string;
  branchId: number;
  branchName: string;
  onHand: number;
  agingDays: number | null;
  velocity30d: number;
  reorderPoint: number | null;
  velocityTag: string | null;
  minStock: number | null;
}

interface BranchSummary {
  branchId: number;
  branchName: string;
  units: number;
  sellValue: number;
  costValue: number;
  distinctSkus: number;
  belowMinCount: number;
  deadCount: number;
}

interface AgingBucket {
  label: string;
  count: number;
  units: number;
}

interface Transfer {
  productId: number;
  productCode: string;
  productName: string;
  fromBranchName: string;
  fromOnHand: number;
  toBranchName: string;
  toOnHand: number;
  suggestedQty: number;
  reason: string;
}

type Tab = 'summary' | 'low' | 'dead' | 'aging' | 'transfers';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'summary', label: 'Tổng quan' },
  { key: 'low', label: 'Tồn thấp' },
  { key: 'dead', label: 'Dead stock' },
  { key: 'aging', label: 'Aging' },
  { key: 'transfers', label: 'Gợi ý chuyển' },
];

export default function StockPage() {
  const [tab, setTab] = useState<Tab>('summary');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tồn kho</h1>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-b-2 border-primary' : 'text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'summary' && <SummaryTab />}
      {tab === 'low' && <LowTab />}
      {tab === 'dead' && <DeadTab />}
      {tab === 'aging' && <AgingTab />}
      {tab === 'transfers' && <TransferTab />}
    </div>
  );
}

function SummaryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-summary-full'],
    queryFn: () =>
      getApiClient()
        .get<BranchSummary[]>('/stock/summary')
        .then((r) => r.data),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {data?.map((b) => (
        <Card key={b.branchId}>
          <CardHeader>
            <CardTitle>{b.branchName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Đơn vị</span>
              <span className="font-medium">{b.units.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giá vốn</span>
              <span>{formatVnd(b.costValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giá bán</span>
              <span>{formatVnd(b.sellValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SKU</span>
              <span>{b.distinctSkus}</span>
            </div>
            <div className="flex gap-2 pt-2">
              {b.belowMinCount > 0 && <Badge variant="warning">Thấp: {b.belowMinCount}</Badge>}
              {b.deadCount > 0 && <Badge variant="destructive">Dead: {b.deadCount}</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>Chi nhánh</TableHead>
            <TableHead className="text-right">Tồn</TableHead>
            <TableHead className="text-right">Aging</TableHead>
            <TableHead className="text-right">Velocity</TableHead>
            <TableHead>Tag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.productId}-${r.branchId}`}>
              <TableCell className="font-mono text-xs">{r.productCode}</TableCell>
              <TableCell>{r.productName}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.branchName}</TableCell>
              <TableCell className="text-right">
                {r.onHand}
                {r.minStock !== null && r.onHand < r.minStock && (
                  <span className="ml-1 text-xs text-red-600">/ {r.minStock}</span>
                )}
              </TableCell>
              <TableCell className="text-right text-xs">
                {r.agingDays !== null ? `${r.agingDays}d` : '—'}
              </TableCell>
              <TableCell className="text-right text-xs">{r.velocity30d.toFixed(2)}/d</TableCell>
              <TableCell>
                {r.velocityTag && <Badge variant="outline">{r.velocityTag}</Badge>}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                Không có dòng nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function LowTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-low'],
    queryFn: () =>
      getApiClient()
        .get<StockRow[]>('/stock/low')
        .then((r) => r.data),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return <StockTable rows={data ?? []} />;
}

function DeadTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-dead'],
    queryFn: () =>
      getApiClient()
        .get<StockRow[]>('/stock/dead')
        .then((r) => r.data),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return <StockTable rows={data ?? []} />;
}

function AgingTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-aging'],
    queryFn: () =>
      getApiClient()
        .get<AgingBucket[]>('/stock/aging')
        .then((r) => r.data),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const maxUnits = Math.max(1, ...(data ?? []).map((b) => b.units));
  return (
    <div className="space-y-2">
      {data?.map((b) => (
        <div key={b.label} className="flex items-center gap-4">
          <div className="w-20 text-sm">{b.label} ngày</div>
          <div className="flex-1">
            <div
              className="h-6 rounded bg-primary/20"
              style={{ width: `${(b.units / maxUnits) * 100}%` }}
            />
          </div>
          <div className="w-32 text-right text-sm text-muted-foreground">
            {b.count} SKU · {b.units} đơn vị
          </div>
        </div>
      ))}
    </div>
  );
}

function TransferTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () =>
      getApiClient()
        .get<Transfer[]>('/stock/transfer-suggestions')
        .then((r) => r.data),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>SP</TableHead>
            <TableHead>Từ CN</TableHead>
            <TableHead>Đến CN</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
            <TableHead>Lý do</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((t, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{t.productCode}</TableCell>
              <TableCell>{t.productName}</TableCell>
              <TableCell>
                {t.fromBranchName} <span className="text-muted-foreground">({t.fromOnHand})</span>
              </TableCell>
              <TableCell>
                {t.toBranchName} <span className="text-muted-foreground">({t.toOnHand})</span>
              </TableCell>
              <TableCell className="text-right font-medium">{t.suggestedQty}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.reason}</TableCell>
            </TableRow>
          ))}
          {data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Không có gợi ý chuyển hàng.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
