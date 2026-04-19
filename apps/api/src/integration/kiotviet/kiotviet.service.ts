import { Injectable } from '@nestjs/common';
import { BranchApi } from './endpoints/branch.api';
import { CategoryApi } from './endpoints/category.api';
import { CustomerApi } from './endpoints/customer.api';
import { InvoiceApi } from './endpoints/invoice.api';
import { OrderApi } from './endpoints/order.api';
import { ProductApi } from './endpoints/product.api';
import { UserApi } from './endpoints/user.api';

/**
 * Facade aggregating all KiotViet endpoint wrappers. Inject this in sync
 * strategies / services that need KiotViet data:
 *
 *   constructor(private readonly kv: KiotVietService) {}
 *   await this.kv.customers.list({ lastModifiedFrom: ... })
 */
@Injectable()
export class KiotVietService {
  constructor(
    public readonly branches: BranchApi,
    public readonly users: UserApi,
    public readonly categories: CategoryApi,
    public readonly products: ProductApi,
    public readonly customers: CustomerApi,
    public readonly orders: OrderApi,
    public readonly invoices: InvoiceApi,
  ) {}
}
