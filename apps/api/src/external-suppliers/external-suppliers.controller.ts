import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExternalSuppliersService } from './external-suppliers.service';
import { CreateExternalSupplierDto } from './dto/create-external-supplier.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { PermissionMatrixGuard } from '../auth/guards/permission-matrix.guard';
import { RequiresPermission } from '../auth/decorators/requires-permission.decorator';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('external-suppliers')
@ApiBearerAuth()
@Controller('orders/:orderId/external-supplier')
@UseGuards(AdminAuthGuard)
export class ExternalSuppliersController {
  constructor(private readonly externalSuppliers: ExternalSuppliersService) {}

  @Post()
  create(@Param('orderId') orderId: string, @Body() dto: CreateExternalSupplierDto) {
    return this.externalSuppliers.create(orderId, dto);
  }

  @Get()
  get(@Param('orderId') orderId: string) {
    return this.externalSuppliers.get(orderId);
  }

  @Post('vetting/propose-approval')
  @UseGuards(PermissionMatrixGuard)
  @RequiresPermission('EXTERNAL_SUPPLIER_FINAL_APPROVAL')
  proposeApproval(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('approverId') approverId: string) {
    return this.externalSuppliers.proposeApproval(orderId, req.actor!, approverId);
  }

  @Post('vetting/approve')
  @UseGuards(PermissionMatrixGuard)
  @RequiresPermission('EXTERNAL_SUPPLIER_FINAL_APPROVAL')
  approve(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.externalSuppliers.approve(orderId, req.actor!, expectedStateVersion);
  }

  @Post('vetting/reject')
  reject(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.externalSuppliers.reject(orderId, req.actor!, expectedStateVersion);
  }
}
