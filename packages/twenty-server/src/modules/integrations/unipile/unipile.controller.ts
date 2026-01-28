import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { UnipileService } from './unipile.service';

// Expose both plain and `/rest` prefixed routes so Apollo REST link (/rest/...) works
@Controller(['integrations/unipile', 'rest/integrations/unipile'])
export class UnipileController {
  private readonly logger = new Logger(UnipileController.name);

  constructor(private readonly unipile: UnipileService) {}

  @Get('hello')
  async hello() {
    try {
      console.log('flag');
      // Proxy to Unipile hello endpoint via service
      return await this.unipile.hello();
    } catch (err: any) {
      // Log the original error for server-side debugging
      this.logger.error('Unipile hello proxy error', err?.stack ?? err);

      // If this error comes from axios/http upstream, prefer that status
      const upstreamStatus = err?.response?.status;
      const upstreamData = err?.response?.data;

      const detail = upstreamData
        ? typeof upstreamData === 'string'
          ? upstreamData
          : JSON.stringify(upstreamData)
        : err?.message ?? String(err);

      const statusToReturn = typeof upstreamStatus === 'number' ? upstreamStatus : HttpStatus.BAD_GATEWAY;

      throw new HttpException(
        {
          message: 'Unipile proxy failed',
          detail,
        },
        statusToReturn,
      );
    }
  }
}
