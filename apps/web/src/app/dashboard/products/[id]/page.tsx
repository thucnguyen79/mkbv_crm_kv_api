'use client';

import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Trash2, Upload, Star, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { formatVnd } from '@/lib/format';

interface ProductImage {
  id: number;
  url: string;
  filename: string;
  isPrimary: boolean;
  caption: string | null;
}

interface ProductDetail {
  id: number;
  code: string;
  name: string;
  basePrice: number;
  costPrice: number;
  barcode: string | null;
  description: string | null;
  tags: string[];
  attributes: Record<string, unknown> | null;
  minStock: number | null;
  isTracked: boolean;
  variantGroup: { id: number; name: string } | null;
  category: { id: number; name: string } | null;
  images: ProductImage[];
  stocks: Array<{
    branch: { id: number; name: string };
    onHand: number;
    reserved: number;
    velocity30d: number;
    reorderPoint: number | null;
    velocityTag: string | null;
    agingDays: number | null;
  }>;
}

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/api\/v1$/,
  '',
);

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canEdit = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  const fileInput = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () =>
      getApiClient()
        .get<ProductDetail>(`/products/${productId}`)
        .then((r) => r.data),
  });

  const [tagsInput, setTagsInput] = useState('');
  const [attrsJson, setAttrsJson] = useState('');
  const [minStock, setMinStock] = useState<string>('');
  const [isTracked, setIsTracked] = useState(true);
  const [description, setDescription] = useState('');

  // sync form state khi data load
  const loaded = data;
  if (loaded && tagsInput === '' && attrsJson === '' && minStock === '' && description === '') {
    // init 1 lần khi fetched
    setTagsInput(loaded.tags.join(', '));
    setAttrsJson(JSON.stringify(loaded.attributes ?? {}, null, 2));
    setMinStock(loaded.minStock?.toString() ?? '');
    setIsTracked(loaded.isTracked);
    setDescription(loaded.description ?? '');
  }

  const saveCrm = useMutation({
    mutationFn: async () => {
      let attributes: Record<string, unknown> = {};
      try {
        attributes = attrsJson ? JSON.parse(attrsJson) : {};
      } catch (err) {
        throw new Error(`Attributes JSON invalid: ${(err as Error).message}`);
      }
      return getApiClient().patch(`/products/${productId}`, {
        description: description || undefined,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        attributes,
        minStock: minStock === '' ? null : Number(minStock),
        isTracked,
      });
    },
    onSuccess: () => {
      toast.success('Đã lưu');
      qc.invalidateQueries({ queryKey: ['product', productId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const uploadImages = useMutation({
    mutationFn: (files: FileList) => {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('files', f));
      return getApiClient().post(`/products/${productId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Đã upload');
      qc.invalidateQueries({ queryKey: ['product', productId] });
      if (fileInput.current) fileInput.current.value = '';
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const deleteImage = useMutation({
    mutationFn: (imageId: number) =>
      getApiClient().delete(`/products/${productId}/images/${imageId}`),
    onSuccess: () => {
      toast.success('Đã xoá ảnh');
      qc.invalidateQueries({ queryKey: ['product', productId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const setPrimary = useMutation({
    mutationFn: (imageId: number) =>
      getApiClient().post(`/products/${productId}/images/${imageId}/primary`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product', productId] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-xs text-muted-foreground">{data.code}</div>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.category && <Badge variant="outline">{data.category.name}</Badge>}
          {data.variantGroup && <Badge variant="secondary">{data.variantGroup.name}</Badge>}
          {data.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ảnh sản phẩm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {data.images.map((img) => (
                <div key={img.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${UPLOADS_BASE}/uploads/${img.url}`}
                    alt={img.filename}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  {img.isPrimary && (
                    <Badge className="absolute left-1 top-1" variant="success">
                      Chính
                    </Badge>
                  )}
                  {canEdit && (
                    <div className="absolute right-1 top-1 flex gap-1">
                      {!img.isPrimary && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7"
                          onClick={() => setPrimary.mutate(img.id)}
                          title="Đặt làm ảnh chính"
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={() => {
                          if (confirm('Xoá ảnh này?')) deleteImage.mutate(img.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {canEdit && (
                <label
                  htmlFor="images-upload"
                  className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed hover:bg-muted/50"
                >
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <input
                    id="images-upload"
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) uploadImages.mutate(e.target.files);
                    }}
                  />
                </label>
              )}
            </div>
            {uploadImages.isPending && (
              <div className="mt-2 text-xs text-muted-foreground">
                <Upload className="mr-1 inline h-3 w-3" />
                Đang upload…
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giá bán</span>
              <span>{formatVnd(data.basePrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giá vốn</span>
              <span>{formatVnd(data.costPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Barcode</span>
              <span className="font-mono">{data.barcode ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tracked</span>
              <span>{data.isTracked ? 'Có' : 'Không'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min stock</span>
              <span>{data.minStock ?? '—'}</span>
            </div>
            {data.description && (
              <div>
                <div className="text-xs text-muted-foreground">Mô tả</div>
                <div>{data.description}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Chỉnh sửa (phía CRM)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tags">Tags (phân cách bằng dấu phẩy)</Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="hot-sale, new-arrival, fragile"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="minStock">Min stock (cảnh báo khi onHand &lt; N)</Label>
                <Input
                  id="minStock"
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="attributes">Attributes (JSON)</Label>
              <Textarea
                id="attributes"
                rows={4}
                className="font-mono text-xs"
                value={attrsJson}
                onChange={(e) => setAttrsJson(e.target.value)}
                placeholder='{ "color": "brown", "frameType": "full" }'
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isTracked" checked={isTracked} onCheckedChange={setIsTracked} />
              <Label htmlFor="isTracked">Track tồn kho</Label>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveCrm.mutate()} disabled={saveCrm.isPending}>
                Lưu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tồn kho theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CN</TableHead>
                <TableHead className="text-right">OnHand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Velocity</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Aging</TableHead>
                <TableHead>Tag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stocks.map((s) => (
                <TableRow key={s.branch.id}>
                  <TableCell>{s.branch.name}</TableCell>
                  <TableCell className="text-right">{s.onHand}</TableCell>
                  <TableCell className="text-right">{s.reserved}</TableCell>
                  <TableCell className="text-right">{s.velocity30d.toFixed(2)}/d</TableCell>
                  <TableCell className="text-right">{s.reorderPoint ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {s.agingDays !== null ? `${s.agingDays}d` : '—'}
                  </TableCell>
                  <TableCell>
                    {s.velocityTag && <Badge variant="outline">{s.velocityTag}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
