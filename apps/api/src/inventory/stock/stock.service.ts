import { Injectable } from '@nestjs/common';
import { Prisma, ProductStock, VelocityTag } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app.config';
import { agingDays } from '../velocity/velocity.util';

export interface StockRow {
  productId: number;
  productCode: string;
  productName: string;
  branchId: number;
  branchName: string;
  onHand: number;
  reserved: number;
  agingDays: number | null;
  velocity30d: number;
  reorderPoint: number | null;
  velocityTag: VelocityTag | null;
  minStock: number | null;
}

export interface BranchStockSummary {
  branchId: number;
  branchName: string;
  units: number;
  sellValue: number;
  costValue: number;
  distinctSkus: number;
  belowMinCount: number;
  deadCount: number;
}

export interface TransferSuggestion {
  productId: number;
  productCode: string;
  productName: string;
  fromBranchId: number;
  fromBranchName: string;
  fromOnHand: number;
  toBranchId: number;
  toBranchName: string;
  toOnHand: number;
  suggestedQty: number;
  reason: string;
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  async list(filters: {
    branchId?: number;
    velocityTag?: VelocityTag;
    belowMin?: boolean;
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ rows: StockRow[]; total: number }> {
    const where: Prisma.ProductStockWhereInput = {
      product: { isTracked: true },
    };
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.velocityTag) where.velocityTag = filters.velocityTag;
    if (filters.search) {
      where.product = {
        ...(where.product as Prisma.ProductWhereInput),
        OR: [
          { code: { contains: filters.search, mode: 'insensitive' } },
          { name: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.productStock.findMany({
        where,
        include: {
          product: { select: { code: true, name: true, minStock: true } },
          branch: { select: { name: true } },
        },
        orderBy: [{ branchId: 'asc' }, { productId: 'asc' }],
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.productStock.count({ where }),
    ]);

    const now = new Date();
    let mapped: StockRow[] = rows.map((s) => ({
      productId: s.productId,
      productCode: s.product.code,
      productName: s.product.name,
      branchId: s.branchId,
      branchName: s.branch.name,
      onHand: s.onHand,
      reserved: s.reserved,
      agingDays: agingDays(s.lastStockIncreaseAt, now),
      velocity30d: s.velocity30d,
      reorderPoint: s.reorderPoint,
      velocityTag: s.velocityTag,
      minStock: s.product.minStock,
    }));

    if (filters.belowMin) {
      mapped = mapped.filter((r) => r.minStock !== null && r.onHand < r.minStock);
    }
    return { rows: mapped, total };
  }

  async lowStock(branchId?: number): Promise<StockRow[]> {
    const rows = await this.prisma.productStock.findMany({
      where: {
        product: { isTracked: true, minStock: { not: null } },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        product: { select: { code: true, name: true, minStock: true } },
        branch: { select: { name: true } },
      },
    });
    const now = new Date();
    return rows
      .filter((s) => s.product.minStock !== null && s.onHand < s.product.minStock)
      .map((s) => ({
        productId: s.productId,
        productCode: s.product.code,
        productName: s.product.name,
        branchId: s.branchId,
        branchName: s.branch.name,
        onHand: s.onHand,
        reserved: s.reserved,
        agingDays: agingDays(s.lastStockIncreaseAt, now),
        velocity30d: s.velocity30d,
        reorderPoint: s.reorderPoint,
        velocityTag: s.velocityTag,
        minStock: s.product.minStock,
      }));
  }

  async deadStock(agingDaysGte?: number): Promise<StockRow[]> {
    const cutoff = new Date(
      Date.now() - (agingDaysGte ?? this.cfg.inventory.deadAgingDays) * 86_400_000,
    );
    const rows = await this.prisma.productStock.findMany({
      where: {
        onHand: { gt: 0 },
        lastStockIncreaseAt: { lt: cutoff },
        product: { isTracked: true },
      },
      include: {
        product: { select: { code: true, name: true, minStock: true } },
        branch: { select: { name: true } },
      },
      orderBy: { lastStockIncreaseAt: 'asc' }, // cũ nhất trước
    });
    const now = new Date();
    return rows.map((s) => ({
      productId: s.productId,
      productCode: s.product.code,
      productName: s.product.name,
      branchId: s.branchId,
      branchName: s.branch.name,
      onHand: s.onHand,
      reserved: s.reserved,
      agingDays: agingDays(s.lastStockIncreaseAt, now),
      velocity30d: s.velocity30d,
      reorderPoint: s.reorderPoint,
      velocityTag: s.velocityTag,
      minStock: s.product.minStock,
    }));
  }

  async agingHistogram(branchId?: number) {
    const rows = await this.prisma.productStock.findMany({
      where: { onHand: { gt: 0 }, ...(branchId ? { branchId } : {}) },
      select: { lastStockIncreaseAt: true, onHand: true },
    });
    const now = new Date();
    const buckets = [
      { label: '0-30', min: 0, max: 30, count: 0, units: 0 },
      { label: '30-60', min: 30, max: 60, count: 0, units: 0 },
      { label: '60-90', min: 60, max: 90, count: 0, units: 0 },
      { label: '90-180', min: 90, max: 180, count: 0, units: 0 },
      { label: '180+', min: 180, max: Infinity, count: 0, units: 0 },
    ];
    for (const r of rows) {
      const d = agingDays(r.lastStockIncreaseAt, now);
      if (d === null) continue;
      const b = buckets.find((x) => d >= x.min && d < x.max);
      if (b) {
        b.count++;
        b.units += r.onHand;
      }
    }
    return buckets.map(({ min: _min, max: _max, ...rest }) => rest);
  }

  /**
   * Tổng giá trị tồn theo CN — cost (giá mua) và sell (giá bán).
   */
  async summary(): Promise<BranchStockSummary[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        branchId: number;
        branchName: string;
        units: bigint | number;
        sellValue: string; // numeric from SUM(Decimal)
        costValue: string;
        distinctSkus: bigint | number;
        belowMinCount: bigint | number;
        deadCount: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        b.id   AS "branchId",
        b.name AS "branchName",
        COALESCE(SUM(ps."onHand"), 0)::bigint AS units,
        COALESCE(SUM(ps."onHand" * p."basePrice"), 0)::text AS "sellValue",
        COALESCE(SUM(ps."onHand" * p."costPrice"), 0)::text AS "costValue",
        COUNT(DISTINCT CASE WHEN ps."onHand" > 0 THEN ps."productId" END)::bigint AS "distinctSkus",
        COUNT(CASE WHEN p."minStock" IS NOT NULL AND ps."onHand" < p."minStock" THEN 1 END)::bigint AS "belowMinCount",
        COUNT(CASE WHEN ps."velocityTag" = 'DEAD' THEN 1 END)::bigint AS "deadCount"
      FROM "Branch" b
      LEFT JOIN "ProductStock" ps ON ps."branchId" = b.id
      LEFT JOIN "Product" p ON p.id = ps."productId" AND p."isTracked" = true
      GROUP BY b.id, b.name
      ORDER BY b.id
    `);
    return result.map((r) => ({
      branchId: r.branchId,
      branchName: r.branchName,
      units: Number(r.units),
      sellValue: Number(r.sellValue),
      costValue: Number(r.costValue),
      distinctSkus: Number(r.distinctSkus),
      belowMinCount: Number(r.belowMinCount),
      deadCount: Number(r.deadCount),
    }));
  }

  /**
   * Gợi ý chuyển hàng giữa CN:
   * - CN "thiếu": onHand < reorderPoint (hoặc < minStock nếu reorder chưa có)
   * - CN "thừa": onHand > reorderPoint × 2 (buffer gấp đôi nhu cầu)
   * - Greedy match: cho mỗi SP thiếu, tìm CN thừa cùng SP để suggest
   */
  async transferSuggestions(): Promise<TransferSuggestion[]> {
    const stocks = await this.prisma.productStock.findMany({
      where: { product: { isTracked: true } },
      include: {
        product: { select: { id: true, code: true, name: true, minStock: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Group theo productId
    const byProduct = new Map<number, typeof stocks>();
    for (const s of stocks) {
      const arr = byProduct.get(s.productId) ?? [];
      arr.push(s);
      byProduct.set(s.productId, arr);
    }

    const out: TransferSuggestion[] = [];

    for (const [, list] of byProduct) {
      if (list.length < 2) continue;

      const surplus: Array<(typeof list)[number] & { spare: number }> = [];
      const deficit: Array<(typeof list)[number] & { need: number }> = [];
      for (const s of list) {
        const rp = s.reorderPoint ?? s.product.minStock ?? 0;
        if (rp === 0) continue;
        if (s.onHand < rp) deficit.push({ ...s, need: rp - s.onHand });
        else if (s.onHand > rp * 2) surplus.push({ ...s, spare: s.onHand - rp });
      }

      // Greedy match
      for (const d of deficit) {
        for (const su of surplus) {
          if (su.spare === 0) continue;
          const qty = Math.min(d.need, su.spare);
          if (qty <= 0) break;
          out.push({
            productId: d.productId,
            productCode: d.product.code,
            productName: d.product.name,
            fromBranchId: su.branchId,
            fromBranchName: su.branch.name,
            fromOnHand: su.onHand,
            toBranchId: d.branchId,
            toBranchName: d.branch.name,
            toOnHand: d.onHand,
            suggestedQty: qty,
            reason: `CN ${d.branch.name} đang dưới reorder point (${d.onHand}/${d.need + d.onHand}), CN ${su.branch.name} thừa ${su.spare}`,
          });
          su.spare -= qty;
          d.need -= qty;
          if (d.need <= 0) break;
        }
      }
    }

    return out.slice(0, 200); // cap output để tránh response quá to
  }
}

export type ProductStockWithRel = ProductStock;
