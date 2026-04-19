'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Shield, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

interface RoleForm {
  id?: number;
  code: string;
  name: string;
  description?: string;
}

export default function RolesPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleForm | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => getApiClient().get<Role[]>('/roles').then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: number) => getApiClient().delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá role');
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quản lý role</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Tạo role
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="h-4 w-4" />
                      {r.name}
                      {r.isSystem && <Badge variant="outline">system</Badge>}
                    </CardTitle>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{r.code}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.description && (
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{r.permissions.length} permission</Badge>
                  <Badge variant="outline" className="gap-1">
                    <UsersIcon className="h-3 w-3" />
                    {r.userCount} user
                  </Badge>
                </div>
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/roles/${r.id}`}>Chỉnh permission</Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing({
                        id: r.id,
                        code: r.code,
                        name: r.name,
                        description: r.description ?? '',
                      });
                      setFormOpen(true);
                    }}
                    title="Sửa info"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!r.isSystem && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (
                          confirm(
                            r.userCount > 0
                              ? `Role "${r.name}" đang gán cho ${r.userCount} user — không thể xoá. Đổi role họ trước.`
                              : `Xoá role "${r.name}"?`,
                          )
                        ) {
                          remove.mutate(r.id);
                        }
                      }}
                      title="Xoá"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoleFormDialog open={formOpen} initial={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function RoleFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: RoleForm | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<RoleForm>({
    defaultValues: initial ?? { code: '', name: '', description: '' },
  });

  // Re-init khi mở
  if (open && !isEdit && !initial) {
    // no-op; defaultValues set
  }

  const mutation = useMutation({
    mutationFn: async (data: RoleForm) => {
      const api = getApiClient();
      const body = {
        code: data.code.toLowerCase().trim(),
        name: data.name,
        description: data.description || undefined,
      };
      return isEdit
        ? api.patch(`/roles/${initial!.id}`, body)
        : api.post('/roles', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật role' : 'Đã tạo role');
      qc.invalidateQueries({ queryKey: ['roles'] });
      reset();
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa role' : 'Tạo role mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="code">Code (slug, unique)</Label>
            <Input
              id="code"
              placeholder="cskh-level1"
              disabled={isEdit && (initial as { isSystem?: boolean })?.isSystem}
              {...register('code', { required: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Tên hiển thị</Label>
            <Input id="name" placeholder="CSKH cấp 1" {...register('name', { required: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea id="description" rows={2} {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isEdit ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
