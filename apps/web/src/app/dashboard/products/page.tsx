'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatVnd } from '@/lib/format';

interface Product {
  id: number;
  code: string;
  name: string;
  basePrice: number;
  costPrice: number;
  tags: string[];
  attributes: Record<string, unknown> | null;
  category: { id: number; name: string } | null;
  variantGroup: { id: number; name: string } | null;
  minStock: number | null;
  isTracked: boolean;
  primaryImage: { url: string; caption: string | null } | null;
  totalOnHand: number;
  stockAtBranch: number | null;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; totalPages: number };
}

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1$/, '');

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [velocityTag, setVelocityTag] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, velocityTag, page }],
    queryFn: () =>
      getApiClient()
        .get<Paginated<Product>>('/products', {
          params: {
            search: search || undefined,
            velocityTag: velocityTag || undefined,
            page,
            pageSize: 20,
          },
        })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sản phẩm</h1>
        <div className="text-sm text-muted-foreground">Tổng {data?.meta.total ?? 0}</div>
      </div>

      <div className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Code / tên / barcode…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <select
          value={velocityTag}
          onChange={(e) => {
            setVelocityTag(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả velocity</option>
          <option value="FAST_MOVER">FAST_MOVER</option>
          <option value="NORMAL">NORMAL</option>
          <option value="SLOW_MOVER">SLOW_MOVER</option>
          <option value="DEAD">DEAD</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ảnh</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead className="text-right">Giá vốn</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${UPLOADS_BASE}/uploads/${p.primaryImage.url}`}
                        alt={p.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/dashboard/products/${p.id}`} className="hover:underline">
                      {p.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/products/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.variantGroup?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatVnd(p.basePrice)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatVnd(p.costPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{p.totalOnHand}</div>
                    {p.minStock !== null && p.totalOnHand < p.minStock && (
                      <Badge variant="warning" className="text-xs">
                        &lt; {p.minStock}
                      </Badge>
                    )}
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
