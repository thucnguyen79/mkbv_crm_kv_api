'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Users,
  ShoppingCart,
  MessageSquare,
  FileText,
  Megaphone,
  ShieldCheck,
  Package,
  Boxes,
  Tag,
  Layers,
  Bell,
  Activity,
  LayoutDashboard,
  FolderTree,
  Settings as SettingsIcon,
  Webhook,
  UserCog,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: 'Tổng quan',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/notifications', label: 'Thông báo', icon: Bell },
    ],
  },
  {
    section: 'Khách hàng',
    items: [
      { href: '/dashboard/customers', label: 'Khách hàng', icon: Users },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: ShoppingCart },
    ],
  },
  {
    section: 'Tồn kho',
    items: [
      { href: '/dashboard/products', label: 'Sản phẩm', icon: Package },
      { href: '/dashboard/stock', label: 'Tồn kho', icon: Boxes },
      { href: '/dashboard/variant-groups', label: 'Nhóm biến thể', icon: FolderTree },
      { href: '/dashboard/attributes', label: 'Thuộc tính', icon: Tag },
    ],
  },
  {
    section: 'Messaging',
    items: [
      { href: '/dashboard/messages', label: 'Tin nhắn', icon: MessageSquare },
      { href: '/dashboard/templates', label: 'Template', icon: FileText },
    ],
  },
  {
    section: 'Campaign',
    items: [
      { href: '/dashboard/campaigns', label: 'Chiến dịch', icon: Megaphone },
      {
        href: '/dashboard/campaign-runs',
        label: 'Duyệt chiến dịch',
        icon: ShieldCheck,
        roles: ['ADMIN', 'MANAGER'],
      },
      { href: '/dashboard/automation', label: 'Automation', icon: Layers },
    ],
  },
  {
    section: 'Hệ thống',
    items: [
      { href: '/dashboard/sync', label: 'Sync KiotViet', icon: Activity },
      { href: '/dashboard/webhooks', label: 'Webhook logs', icon: Webhook, roles: ['ADMIN'] },
      { href: '/dashboard/users', label: 'Quản lý user', icon: UserCog, roles: ['ADMIN'] },
      { href: '/dashboard/roles', label: 'Role & permission', icon: Shield, roles: ['ADMIN'] },
      { href: '/dashboard/settings', label: 'Cấu hình', icon: SettingsIcon, roles: ['ADMIN'] },
    ],
  },
];

const COLLAPSE_KEY = 'mkbv.sidebar.collapsed';

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved === '1') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-background transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {!collapsed && <div className="font-semibold">MKBV CRM</div>}
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((sec) => (
          <div key={sec.section} className="mb-4">
            {!collapsed && (
              <div className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {sec.section}
              </div>
            )}
            {collapsed && <div className="mx-2 my-2 border-t border-border/60" />}
            <ul className="space-y-0.5">
              {sec.items
                .filter((i) => !i.roles || i.roles.includes(role))
                .map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-md text-sm transition-colors',
                          collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5',
                          active
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
