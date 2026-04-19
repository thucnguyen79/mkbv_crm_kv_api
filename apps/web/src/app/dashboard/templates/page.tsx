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
import { TemplateFormDialog, type TemplateFormData } from './template-form';

interface Template extends TemplateFormData {
  id: number;
  placeholders: string[];
}

export default function TemplatesPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === 'ADMIN';

  const [editing, setEditing] = useState<TemplateFormData | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () =>
      getApiClient()
        .get<Template[]>('/templates')
        .then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: number) => getApiClient().delete(`/templates/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá template');
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Template tin nhắn</h1>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Tạo template
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Kênh</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>Biến</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ) : (
              data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.channel}</Badge>
                  </TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                    {t.body}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.placeholders.map((p) => (
                        <Badge key={p} variant="secondary">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.isActive ? <Badge variant="success">on</Badge> : <Badge variant="outline">off</Badge>}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {isAdmin && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(t);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Xoá template ${t.code}?`)) remove.mutate(t.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TemplateFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
