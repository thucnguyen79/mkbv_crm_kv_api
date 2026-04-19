'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

interface Permission {
  id: number;
  code: string;
  resource: string;
  action: string;
  group: string;
  description: string | null;
}

interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const roleId = Number(params.id);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => getApiClient().get<Role>(`/roles/${roleId}`).then((r) => r.data),
  });

  const { data: perms } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => getApiClient().get<Permission[]>('/permissions').then((r) => r.data),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (role) {
      setSelected(new Set(role.permissions));
      setDirty(false);
    }
  }, [role]);

  const grouped = useMemo(() => {
    if (!perms) return [] as Array<{ group: string; items: Permission[] }>;
    const map = new Map<string, Permission[]>();
    for (const p of perms) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [perms]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
    setDirty(true);
  };

  const toggleGroup = (items: Permission[], enable: boolean) => {
    const next = new Set(selected);
    for (const p of items) {
      if (enable) next.add(p.code);
      else next.delete(p.code);
    }
    setSelected(next);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () =>
      getApiClient().put(`/roles/${roleId}/permissions`, {
        codes: Array.from(selected),
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật permission — user sẽ nhận quyền mới ở request kế tiếp');
      qc.invalidateQueries({ queryKey: ['role', roleId] });
      qc.invalidateQueries({ queryKey: ['roles'] });
      setDirty(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (roleLoading || !role) return <Skeleton className="h-60 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/roles')}>
            <ArrowLeft className="mr-1 h-3 w-3" />
            Quay lại
          </Button>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
            {role.name}
            {role.isSystem && <Badge variant="outline">system</Badge>}
          </h1>
          <div className="font-mono text-sm text-muted-foreground">{role.code}</div>
          {role.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
          <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">
              {selected.size} / {perms?.length ?? 0} permission
            </Badge>
            <Badge variant="outline">{role.userCount} user đang dùng</Badge>
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          <Save className="mr-1 h-4 w-4" />
          Lưu thay đổi
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {grouped.map(({ group, items }) => {
          const allOn = items.every((p) => selected.has(p.code));
          const someOn = items.some((p) => selected.has(p.code));
          return (
            <Card key={group}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleGroup(items, !allOn)}
                >
                  {allOn ? (
                    <>
                      <Square className="mr-1 h-3 w-3" />
                      Bỏ tick
                    </>
                  ) : (
                    <>
                      <CheckSquare className="mr-1 h-3 w-3" />
                      {someOn ? 'Tick tất cả' : 'Tick tất cả'}
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-1">
                {items.map((p) => (
                  <label
                    key={p.code}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.code)}
                      onChange={() => toggle(p.code)}
                      className="h-4 w-4"
                    />
                    <span className="font-mono text-xs">{p.code}</span>
                    {p.description && (
                      <span className="text-xs text-muted-foreground">— {p.description}</span>
                    )}
                  </label>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
