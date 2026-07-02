import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminJwtRole } from './jwt-payload.types';
import { Public } from './decorators/public.decorator';

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new ForbiddenException('dev token issuance is disabled outside development/testing');
  }
}

@ApiTags('auth (dev-only token issuance)')
@Controller('auth/dev')
@Public()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('customer-token')
  issueCustomerToken(@Body('customerId') customerId: string) {
    assertNotProduction();
    return { token: this.auth.issueCustomerToken(customerId) };
  }

  @Post('supplier-token')
  issueSupplierToken(@Body('supplierId') supplierId: string) {
    assertNotProduction();
    return { token: this.auth.issueSupplierToken(supplierId) };
  }

  @Post('admin-token')
  issueAdminToken(@Body('adminId') adminId: string, @Body('role') role: AdminJwtRole) {
    assertNotProduction();
    return { token: this.auth.issueAdminToken(adminId, role) };
  }
}
