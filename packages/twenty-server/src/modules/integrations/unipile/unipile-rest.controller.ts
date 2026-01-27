import { Controller, Get } from '@nestjs/common';
import { UnipileService } from './unipile.service';

// Alias controller to expose the same hello endpoint under /rest/*
@Controller('rest/integrations/unipile')
export class UnipileRestController {
  constructor(private readonly unipileService: UnipileService) {}

  @Get('hello')
  getHello() {
    return this.unipileService.getHello();
  }
}
