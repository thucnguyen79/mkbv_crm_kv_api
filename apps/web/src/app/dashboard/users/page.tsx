'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, KeyRound, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
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
import { apiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { UserFormDialog, type UserFormData } from './user-form';
import { ResetPasswordDialog } from './reset-password-dialog';

interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  roleId: number | null;
  roleName: string | null;
  branchId: number | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; totalPages: number };
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserFormData | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: number; email: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, page }],
    queryFn: () =>
      getApiClient()
        .get<Paginated<User>>('/users', {
          params: { search: search || undefined, page, pageSize: 20 },
        })
        .then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: (id: number) => getApiClient().post(`/users/${id}/toggle-active`),
    onSuccess: () => {
      toast.success('Đã đổi trạng thái');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => getApiClient().delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá user');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quản lý user</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Tạo user
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo email hoặc họ tên…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-8"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>CN</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Tạo</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              data?.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell>
                    {u.roleName ? (
                      <Badge variant="secondary">{u.roleName}</Badge>
                    ) : (
                      <Badge variant="outline">{u.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.branchName ?? '—'}
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Badge variant="outline">disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(u.createdAt)}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Sửa"
                      onClick={() => {
                        setEditing({
                          id: u.id,
                          email: u.email,
                          fullName: u.fullName,
                          roleId: u.roleId ?? 0,
                          branchId: u.branchId,
                          isActive: u.isActive,
                        });
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Reset password"
                      onClick={() => setResetTarget({ id: u.id, email: u.email })}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={u.isActive ? 'Deactivate' : 'Activate'}
                      onClick={() => toggle.mutate(u.id)}
                    >
                      <Power
                        className={`h-4 w-4 ${u.isActive ? 'text-green-600' : 'text-muted-foreground'}`}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Xoá"
                      onClick={() => {
                        if (confirm(`Xoá user ${u.email}? Không khôi phục được.`)) {
                          remove.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
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

      <UserFormDialog open={formOpen} initial={editing} onClose={() => setFormOpen(false)} />
      <ResetPasswordDialog
        userId={resetTarget?.id ?? null}
        userEmail={resetTarget?.email ?? ''}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}
