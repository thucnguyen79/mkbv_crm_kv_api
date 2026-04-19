'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { AttributeFormDialog, type AttributeFormData } from './attribute-form';

interface AttributeDef {
  id: number;
  code: string;
  label: string;
  kind: 'STRING' | 'ENUM' | 'NUMBER' | 'BOOLEAN';
  options: unknown;
  isActive: boolean;
}

export default function AttributesPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canEdit = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';
  const isAdmin = session?.user.role === 'ADMIN';

  const [editing, setEditing] = useState<AttributeFormData | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['attribute-definitions'],
    queryFn: () =>
      getApiClient()
        .get<AttributeDef[]>('/attribute-definitions')
        .then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: number) => getApiClient().delete(`/attribute-definitions/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá');
      qc.invalidateQueries({ queryKey: ['attribute-definitions'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Thuộc tính SP</h1>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Tạo thuộc tính
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ) : (
              data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>{a.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.kind}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.options ? JSON.stringify(a.options) : '—'}
                  </TableCell>
                  <TableCell>
                    {a.isActive ? (
                      <Badge variant="success">on</Badge>
                    ) : (
                      <Badge variant="outline">off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing({
                            id: a.id,
                            code: a.code,
                            label: a.label,
                            kind: a.kind,
                            optionsJson: a.options ? JSON.stringify(a.options, null, 2) : '',
                            isActive: a.isActive,
                          });
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Xoá thuộc tính ${a.code}?`)) remove.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AttributeFormDialog open={formOpen} initial={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
