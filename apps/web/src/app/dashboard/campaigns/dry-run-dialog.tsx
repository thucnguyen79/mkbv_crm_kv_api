'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getApiClient } from '@/lib/api';

interface DryRunResult {
  ruleCode: string;
  matchedCount: number;
  previewLimit: number;
  preview: Array<{ customerId: number; phone: string; variables: Record<string, unknown> }>;
}

export function DryRunDialog({
  campaignId,
  onClose,
}: {
  campaignId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dry-run', campaignId],
    queryFn: () =>
      getApiClient()
        .post<DryRunResult>(`/campaigns/${campaignId}/dry-run`)
        .then((r) => r.data),
    enabled: campaignId !== null,
  });

  return (
    <Dialog open={campaignId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dry-run campaign #{campaignId}</DialogTitle>
          <DialogDescription>
            Preview danh sách khách hàng rule match — không enqueue tin nhắn.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {isError && (
          <div className="text-sm text-red-600">
            Lỗi: {(error as Error).message}
          </div>
        )}
        {data && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{data.ruleCode}</Badge>
              <span className="text-sm">
                <strong>{data.matchedCount}</strong> khách hàng match (preview {data.preview.length})
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Biến</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.preview.map((p) => (
                    <TableRow key={p.customerId}>
                      <TableCell className="font-mono text-xs">#{p.customerId}</TableCell>
                      <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {JSON.stringify(p.variables)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.preview.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        Không khách hàng nào match.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
