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
import { getApiClient } from '@/lib/api';
import { formatDateTime, formatVnd } from '@/lib/format';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  gender: boolean | null;
  birthDate: string | null;
  address: string | null;
  totalSpent: number;
  lastPurchaseAt: string | null;
  tier: string | null;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export function CustomerDetailDrawer({
  customerId,
  onClose,
}: {
  customerId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () =>
      getApiClient()
        .get<Customer>(`/customers/${customerId}`)
        .then((r) => r.data),
    enabled: customerId !== null,
  });

  return (
    <Dialog open={customerId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{data?.name ?? 'Chi tiết khách hàng'}</DialogTitle>
          <DialogDescription className="font-mono">{data?.phone}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : data ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Email" value={data.email ?? '—'} />
            <Field label="Giới tính" value={data.gender === true ? 'Nam' : data.gender === false ? 'Nữ' : '—'} />
            <Field label="Ngày sinh" value={data.birthDate ? formatDateTime(data.birthDate) : '—'} />
            <Field
              label="Hạng"
              value={data.tier ? <Badge variant="secondary">{data.tier}</Badge> : '—'}
            />
            <Field label="Điểm" value={data.points.toLocaleString()} />
            <Field label="Tổng chi tiêu" value={formatVnd(data.totalSpent)} />
            <Field label="Mua gần nhất" value={formatDateTime(data.lastPurchaseAt)} />
            <Field label="Tạo" value={formatDateTime(data.createdAt)} />
            {data.address && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Địa chỉ</div>
                <div>{data.address}</div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
