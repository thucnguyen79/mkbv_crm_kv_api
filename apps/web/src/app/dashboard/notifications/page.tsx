'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface Notification {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

const SEVERITY_BADGE: Record<
  Notification['severity'],
  'default' | 'warning' | 'destructive'
> = { INFO: 'default', WARNING: 'warning', CRITICAL: 'destructive' };

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications-all'],
    queryFn: () =>
      getApiClient()
        .get<Paginated<Notification>>('/notifications', { params: { pageSize: 100 } })
        .then((r) => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => getApiClient().post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-all'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => getApiClient().post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-all'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Thông báo</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <CheckCheck className="mr-1 h-4 w-4" />
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {data?.data.map((n) => (
            <Card
              key={n.id}
              className={n.read ? 'opacity-70' : 'border-l-4 border-l-primary'}
            >
              <CardContent className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={SEVERITY_BADGE[n.severity]}>{n.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                    Đánh dấu đã đọc
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {data?.data.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có thông báo nào.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
