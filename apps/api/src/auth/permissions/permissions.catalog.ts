/**
 * Catalog permission của toàn hệ thống. Source of truth — seed vào DB ở boot.
 * Thêm permission mới → thêm vào đây → next boot auto-sync.
 */
export interface PermissionDef {
  code: string;
  resource: string;
  action: string;
  group: string;
  description?: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // Customer
  { code: 'customer.read', resource: 'customer', action: 'read', group: 'Khách hàng' },
  { code: 'customer.write', resource: 'customer', action: 'write', group: 'Khách hàng' },
  { code: 'customer.delete', resource: 'customer', action: 'delete', group: 'Khách hàng' },
  // Order
  { code: 'order.read', resource: 'order', action: 'read', group: 'Đơn hàng' },
  // Product
  { code: 'product.read', resource: 'product', action: 'read', group: 'Sản phẩm' },
  { code: 'product.write', resource: 'product', action: 'write', group: 'Sản phẩm' },
  // Stock
  { code: 'stock.read', resource: 'stock', action: 'read', group: 'Tồn kho' },
  { code: 'stock.transfer_suggest', resource: 'stock', action: 'transfer_suggest', group: 'Tồn kho' },
  { code: 'stock.velocity_recompute', resource: 'stock', action: 'velocity_recompute', group: 'Tồn kho' },
  // Variant group
  { code: 'variant_group.read', resource: 'variant_group', action: 'read', group: 'Biến thể' },
  { code: 'variant_group.write', resource: 'variant_group', action: 'write', group: 'Biến thể' },
  { code: 'variant_group.delete', resource: 'variant_group', action: 'delete', group: 'Biến thể' },
  // Attribute
  { code: 'attribute.read', resource: 'attribute', action: 'read', group: 'Thuộc tính' },
  { code: 'attribute.write', resource: 'attribute', action: 'write', group: 'Thuộc tính' },
  { code: 'attribute.delete', resource: 'attribute', action: 'delete', group: 'Thuộc tính' },
  // Messaging
  { code: 'message.read', resource: 'message', action: 'read', group: 'Messaging' },
  { code: 'message.send', resource: 'message', action: 'send', group: 'Messaging' },
  { code: 'template.read', resource: 'template', action: 'read', group: 'Messaging' },
  { code: 'template.write', resource: 'template', action: 'write', group: 'Messaging' },
  { code: 'template.delete', resource: 'template', action: 'delete', group: 'Messaging' },
  // Campaign
  { code: 'campaign.read', resource: 'campaign', action: 'read', group: 'Campaign' },
  { code: 'campaign.write', resource: 'campaign', action: 'write', group: 'Campaign' },
  { code: 'campaign.delete', resource: 'campaign', action: 'delete', group: 'Campaign' },
  { code: 'campaign.run', resource: 'campaign', action: 'run', group: 'Campaign' },
  { code: 'campaign.dry_run', resource: 'campaign', action: 'dry_run', group: 'Campaign' },
  // Campaign run / approval
  { code: 'campaign_run.read', resource: 'campaign_run', action: 'read', group: 'Duyệt campaign' },
  { code: 'campaign_run.approve', resource: 'campaign_run', action: 'approve', group: 'Duyệt campaign' },
  { code: 'campaign_run.reject', resource: 'campaign_run', action: 'reject', group: 'Duyệt campaign' },
  { code: 'campaign_run.cancel', resource: 'campaign_run', action: 'cancel', group: 'Duyệt campaign' },
  // Automation
  { code: 'automation.read', resource: 'automation', action: 'read', group: 'Automation' },
  // Sync
  { code: 'sync.read', resource: 'sync', action: 'read', group: 'Sync' },
  { code: 'sync.run', resource: 'sync', action: 'run', group: 'Sync' },
  { code: 'sync.stop', resource: 'sync', action: 'stop', group: 'Sync' },
  { code: 'sync.reset', resource: 'sync', action: 'reset', group: 'Sync' },
  // Notification
  { code: 'notification.read', resource: 'notification', action: 'read', group: 'Thông báo' },
  // Webhook
  { code: 'webhook.read', resource: 'webhook', action: 'read', group: 'Hệ thống' },
  // Settings
  { code: 'settings.read', resource: 'settings', action: 'read', group: 'Hệ thống' },
  { code: 'settings.write', resource: 'settings', action: 'write', group: 'Hệ thống' },
  // User management
  { code: 'user.read', resource: 'user', action: 'read', group: 'Quản lý user' },
  { code: 'user.write', resource: 'user', action: 'write', group: 'Quản lý user' },
  { code: 'user.delete', resource: 'user', action: 'delete', group: 'Quản lý user' },
  // Role management
  { code: 'role.read', resource: 'role', action: 'read', group: 'Quản lý user' },
  { code: 'role.write', resource: 'role', action: 'write', group: 'Quản lý user' },
  { code: 'role.delete', resource: 'role', action: 'delete', group: 'Quản lý user' },
];

export const ALL_PERMISSION_CODES: readonly string[] = PERMISSIONS.map((p) => p.code);

/**
 * 3 role preset (isSystem = true, không cho xoá).
 * Thay đổi permission set ở đây → next boot auto-sync (sau seed ban đầu,
 * admin có thể override permission của manager/staff qua UI).
 */
export interface RolePreset {
  code: string;
  name: string;
  description: string;
  permissions: readonly string[];
  /** Nếu true, preset này luôn có toàn bộ permission — không cần list từng cái. */
  all?: boolean;
}

const READ_ONLY_ALL = ALL_PERMISSION_CODES.filter((c) => c.endsWith('.read'));

export const ROLE_PRESETS: readonly RolePreset[] = [
  {
    code: 'admin',
    name: 'Admin',
    description: 'Toàn quyền hệ thống',
    permissions: ALL_PERMISSION_CODES,
    all: true,
  },
  {
    code: 'manager',
    name: 'Manager',
    description: 'Quản lý — duyệt campaign, sửa data (không xoá), chạy sync',
    permissions: [
      ...READ_ONLY_ALL,
      'customer.write',
      'product.write',
      'variant_group.write',
      'attribute.write',
      'template.write',
      'campaign.write',
      'campaign.run',
      'campaign.dry_run',
      'campaign_run.approve',
      'campaign_run.reject',
      'campaign_run.cancel',
      'message.send',
      'stock.transfer_suggest',
      'sync.run',
    ],
  },
  {
    code: 'staff',
    name: 'Nhân viên',
    description: 'Nhân viên CSKH — đọc data, gửi tin, tạo campaign run chờ duyệt',
    permissions: [
      ...READ_ONLY_ALL,
      'message.send',
      'campaign.run',
      'campaign.dry_run',
      'campaign_run.cancel',
    ],
  },
];
