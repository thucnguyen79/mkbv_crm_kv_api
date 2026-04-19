import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { diskStorage } from 'multer';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProductImageService } from './image.service';

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? './uploads';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif)$/i;

function multerStorage() {
  return diskStorage({
    destination: (req, _file, cb) => {
      const productId = (req.params as { id?: string }).id;
      if (!productId || !/^\d+$/.test(productId)) {
        return cb(new Error('Invalid product id'), '');
      }
      const dir = path.join(UPLOAD_ROOT, 'products', productId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`);
    },
  });
}

@ApiTags('product-images')
@ApiBearerAuth()
@Controller({ path: 'products/:id/images', version: '1' })
export class ProductImageController {
  constructor(private readonly service: ProductImageService) {}

  @Get()
  list(@Param('id', ParseIntPipe) id: number) {
    return this.service.list(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Upload tối đa 10 ảnh (JPG/PNG/WEBP/GIF ≤ 5MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerStorage(),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_EXT.test(file.originalname)) {
          return cb(new BadRequestException('Only JPG/PNG/WEBP/GIF allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('caption') caption?: string,
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    return this.service.register(id, files, caption);
  }

  @Delete(':imageId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    await this.service.remove(id, imageId);
  }

  @Post(':imageId/primary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  async setPrimary(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    await this.service.setPrimary(id, imageId);
    return { ok: true };
  }
}
