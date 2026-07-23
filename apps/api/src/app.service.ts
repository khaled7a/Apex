import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Apex Sourcing API — see /docs for the OpenAPI contract.';
  }
}
