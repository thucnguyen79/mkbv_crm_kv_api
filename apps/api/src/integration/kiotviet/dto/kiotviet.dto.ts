/**
 * KiotViet API DTOs — fields we actually use.
 * Full response contains many more fields; we keep `raw` snapshots where relevant.
 */

export interface KvCustomer {
  id: number;
  code: string;
  name: string;
  gender?: boolean;
  birthDate?: string;
  contactNumber?: string;
  address?: string;
  locationName?: string;
  wardName?: string;
  email?: string;
  organization?: string;
  taxCode?: string;
  comments?: string;
  branchId?: number;
  rewardPoint?: number;
  totalInvoiced?: number;
  totalRevenue?: number;
  debt?: number;
  retailerId?: number;
  modifiedDate?: string;
  createdDate?: string;
  customerGroupDetails?: Array<{ groupId: number; groupName: string }>;
  psidFacebook?: string;
}

export interface KvOrderDetail {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
  note?: string;
}

export interface KvOrder {
  id: number;
  code: string;
  purchaseDate: string;
  branchId: number;
  branchName?: string;
  soldById?: number;
  customerId?: number;
  customerCode?: string;
  customerName?: string;
  total: number;
  totalPayment?: number;
  discount?: number;
  status: number;
  statusValue?: string;
  description?: string;
  orderDetails?: KvOrderDetail[];
  modifiedDate?: string;
  createdDate?: string;
}

export interface KvInvoice extends Omit<KvOrder, 'orderDetails'> {
  invoiceDetails?: KvOrderDetail[];
  payments?: Array<{ method: string; amount: number; status: number }>;
}

export interface KvProductInventory {
  branchId: number;
  branchName?: string;
  cost?: number;
  onHand: number;
  reserved?: number;
  actualReserved?: number;
}

export interface KvProduct {
  id: number;
  code: string;
  name: string;
  barcode?: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  basePrice?: number;
  cost?: number; // giá mua
  isActive?: boolean;
  masterProductId?: number;
  masterCode?: string;
  masterProductName?: string;
  inventories?: KvProductInventory[];
  modifiedDate?: string;
  createdDate?: string;
}

export interface KvCategory {
  categoryId: number;
  categoryName: string;
  parentId?: number;
  hasChild?: boolean;
  retailerId?: number;
  modifiedDate?: string;
}

export interface KvBranch {
  id: number;
  branchName: string;
  address?: string;
  locationName?: string;
  contactNumber?: string;
  retailerId?: number;
  isActive?: boolean;
  modifiedDate?: string;
}

export interface KvUser {
  id: number;
  userName: string;
  givenName?: string;
  address?: string;
  mobilePhone?: string;
  email?: string;
  birthDate?: string;
  retailerId?: number;
}

export interface KvWebhookNotification<T = unknown> {
  Action: string;
  Data: T[];
}

export interface KvWebhookPayload {
  Id: string;
  Attempt: number;
  Notifications: KvWebhookNotification[];
}
