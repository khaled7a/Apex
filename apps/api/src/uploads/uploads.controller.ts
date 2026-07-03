import { Body, Controller, Get, NotFoundException, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { UploadsService } from './uploads.service';
import { AnyActorAuthGuard } from '../auth/guards/any-actor-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

/**
 * Generic file attachment for an order — the URL this returns is what gets
 * passed as `fileUrl` in UploadReceiptDto/UploadCustomsProofDto/etc.
 * memoryStorage (not disk) because destination() would need `orderId` from
 * the multipart body, which multer cannot guarantee has already streamed in
 * by the time it decides where to write the file part.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(AnyActorAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(@Req() req: RequestWithActor, @Body('orderId') orderId: string, @UploadedFile() file: Express.Multer.File) {
    return this.uploads.save(req.actor!, orderId, file);
  }

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const stored = await this.uploads.resolve(id);
    if (!stored) throw new NotFoundException(`upload ${id} not found`);
    res.setHeader('Content-Type', stored.mimeType);
    res.sendFile(path.resolve(stored.filePath));
  }
}
