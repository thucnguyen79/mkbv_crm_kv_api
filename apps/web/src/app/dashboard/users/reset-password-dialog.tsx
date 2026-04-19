'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

export function ResetPasswordDialog({
  userId,
  userEmail,
  onClose,
}: {
  userId: number | null;
  userEmail: string;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: () =>
      getApiClient().post(`/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      setDone(true);
      toast.success('Password đã đổi. Gửi cho user qua kênh an toàn.');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const copyInfo = async () => {
    await navigator.clipboard.writeText(
      `Email: ${userEmail}\nPassword: ${newPassword}\nĐăng nhập: http://localhost:3001/login`,
    );
    toast.success('Đã copy — paste vào email / Zalo để gửi user');
  };

  const close = () => {
    setNewPassword('');
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={userId !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password cho {userEmail}</DialogTitle>
          <DialogDescription>
            Admin đặt password mới → gửi user qua kênh an toàn (Zalo / email riêng).
            Refresh token của user bị thu hồi, họ phải login lại.
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="newPassword">Password mới (≥ 8 ký tự)</Label>
              <Input
                id="newPassword"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="VD: Xin-chao-2026"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Bạn tự chọn password rồi gửi user. Không có email reset link tự động.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Huỷ
              </Button>
              <Button
                onClick={() => reset.mutate()}
                disabled={newPassword.length < 8 || reset.isPending}
              >
                <KeyRound className="mr-1 h-4 w-4" />
                Đổi password
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm">
              <div>Email: {userEmail}</div>
              <div>Password: {newPassword}</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copyInfo}>
                <Copy className="mr-1 h-4 w-4" />
                Copy thông tin
              </Button>
              <Button onClick={close}>Xong</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
