import { Module } from '@nestjs/common';
import { KiotVietAuthService } from './kiotviet-auth.service';
import { KiotVietHttpService } from './kiotviet-http.service';
import { KiotVietService } from './kiotviet.service';
import { BranchApi } from './endpoints/branch.api';
import { UserApi } from './endpoints/user.api';
import { CategoryApi } from './endpoints/category.api';
import { ProductApi } from './endpoints/product.api';
import { CustomerApi } from './endpoints/customer.api';
import { OrderApi } from './endpoints/order.api';
import { InvoiceApi } from './endpoints/invoice.api';

@Module({
  providers: [
    KiotVietAuthService,
    KiotVietHttpService,
    BranchApi,
    UserApi,
    CategoryApi,
    ProductApi,
    CustomerApi,
    OrderApi,
    InvoiceApi,
    KiotVietService,
  ],
  exports: [KiotVietService, KiotVietAuthService],
})
export class KiotVietModule {}
