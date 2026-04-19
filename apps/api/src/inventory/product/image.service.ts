import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductImage } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app.config';

export interface ImageUploadMeta {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

@Injectable()
export class ProductImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  async list(productId: number): Promise<ProductImage[]> {
    await this.ensureProduct(productId);
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  }

  /** Ghi record DB sau khi multer đã save file xuống disk. */
  async register(
    productId: number,
    files: ImageUploadMeta[],
    caption?: string,
  ): Promise<ProductImage[]> {
    await this.ensureProduct(productId);
    const existing = await this.prisma.productImage.count({ where: { productId } });
    const out: ProductImage[] = [];
    let order = existing;
    for (const f of files) {
      const rel = path.posix.join('products', String(productId), f.filename);
      const img = await this.prisma.productImage.create({
        data: {
          productId,
          url: rel,
          filename: f.originalname,
          mimeType: f.mimetype,
          sizeBytes: f.size,
          order: order++,
          isPrimary: existing === 0 && out.length === 0, // ảnh đầu tiên là primary
          caption: caption ?? null,
        },
      });
      out.push(img);
    }
    return out;
  }

  async remove(productId: number, imageId: number): Promise<void> {
    const img = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!img) throw new NotFoundException(`Image ${imageId} not found`);

    const abs = path.join(this.cfg.inventory.uploadDir, img.url);
    await this.prisma.productImage.delete({ where: { id: imageId } });
    try {
      await fs.unlink(abs);
    } catch {
      // file đã bị xoá ngoài DB — không coi là lỗi
    }

    // Nếu xoá đúng primary, promote ảnh đầu tiên còn lại
    if (img.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { order: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
  }

  async setPrimary(productId: number, imageId: number): Promise<void> {
    const img = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!img) throw new NotFoundException(`Image ${imageId} not found`);
    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);
  }

  private async ensureProduct(productId: number): Promise<void> {
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!p) throw new BadRequestException(`Product ${productId} not found`);
  }
}
