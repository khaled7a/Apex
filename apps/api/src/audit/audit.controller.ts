import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditLog: AuditLogService) {}

  /** Recomputes the hash chain end-to-end — proof the append-only guarantee holds, not just a claim. */
  @Get('verify-chain')
  @UseGuards(AdminAuthGuard)
  verifyChain() {
    return this.auditLog.verifyChainIntegrity();
  }
}
