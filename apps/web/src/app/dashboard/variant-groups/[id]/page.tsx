'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatVnd } from '@/lib/format';

interface VariantGroupDetail {
  id: number;
  code: string;
  name: string;
  description: string | null;
  totalOnHand: number;
  variants: Array<{
    id: number;
    code: string;
    name: string;
    basePrice: number;
    attributes: Record<string, unknown> | null;
    totalOnHand: number;
    primaryImage: string | null;
  }>;
}

export default function VariantGroupDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['variant-group', params.id],
    queryFn: () =>
      getApiClient()
        .get<VariantGroupDetail>(`/variant-groups/${params.id}`)
        .then((r) => r.data),
  });

  if (isLoading || !data) return <Skeleton className="h-60 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{data.name}</CardTitle>
          <div className="font-mono text-xs text-muted-foreground">{data.code}</div>
          {data.description && <p className="text-sm">{data.description}</p>}
          <div className="pt-2">
            <Badge>Tổng tồn kho: {data.totalOnHand}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Thuộc tính</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.code}</TableCell>
                  <TableCell>{v.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.attributes ? JSON.stringify(v.attributes) : '—'}
                  </TableCell>
                  <TableCell className="text-right">{formatVnd(v.basePrice)}</TableCell>
                  <TableCell className="text-right font-medium">{v.totalOnHand}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
