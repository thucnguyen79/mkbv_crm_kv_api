'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Bell, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getApiClient } from '@/lib/api';
import { ThemeToggle } from './theme-toggle';

interface NotificationListResponse {
  data: Array<{ id: string; read: boolean; title: string }>;
  meta: { total: number };
}

export function Topbar() {
  const { data: session } = useSession();
  const user = session?.user;

  // Ping unread-count cứ 60s (lightweight)
  const { data } = useQuery<NotificationListResponse>({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const res = await getApiClient().get<NotificationListResponse>('/notifications', {
        params: { pageSize: 10 },
      });
      return res.data;
    },
    refetchInterval: 60_000,
    enabled: !!session,
  });
  const unreadCount = data?.data.filter((n) => !n.read).length ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="text-sm text-muted-foreground">
        {user?.branchId ? `Chi nhánh #${user.branchId}` : 'Toàn hệ thống'}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link href="/dashboard/notifications" aria-label="Thông báo">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <UserIcon className="h-4 w-4" />
              <span className="hidden text-sm md:inline">{user?.fullName ?? user?.email}</span>
              <Badge variant="outline" className="hidden md:inline-flex">
                {user?.role}
              </Badge>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
