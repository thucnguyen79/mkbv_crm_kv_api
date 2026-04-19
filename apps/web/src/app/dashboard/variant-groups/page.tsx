'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { VariantGroupFormDialog, type VariantGroupFormData } from './variant-group-form';

interface VariantGroup {
  id: number;
  code: string;
  name: string;
  description: string | null;
  productCount: number;
  createdAt: string;
}

export default function VariantGroupsPage() {
  const { data: session } = useSession();
  const canEdit = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VariantGroupFormData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['variant-groups'],
    queryFn: () =>
      getApiClient()
        .get<VariantGroup[]>('/variant-groups')
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nhóm biến thể</h1>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Tạo nhóm
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((g) => (
            <Card key={g.id} className="transition hover:border-primary/50 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/dashboard/variant-groups/${g.id}`} className="hover:underline">
                    {g.name}
                  </Link>
                </CardTitle>
                <div className="font-mono text-xs text-muted-foreground">{g.code}</div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <Badge>{g.productCount} biến thể</Badge>
                  {g.description && (
                    <p className="mt-2 text-xs text-muted-foreground">{g.description}</p>
                  )}
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing({
                        id: g.id,
                        code: g.code,
                        name: g.name,
                        description: g.description ?? '',
                      });
                      setFormOpen(true);
                    }}
                  >
                    Sửa
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {data?.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Chưa có nhóm biến thể nào.
            </p>
          )}
        </div>
      )}

      <VariantGroupFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
