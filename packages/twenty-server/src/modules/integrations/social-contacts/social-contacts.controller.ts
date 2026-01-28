import { Controller, Get } from '@nestjs/common';
import { SocialContactsService } from 'src/modules/integrations/social-contacts/social-contact.service';

// Expose both plain and `/rest` prefixed routes so Apollo REST link (/rest/...) works
@Controller(['integrations/social-contacts', 'rest/integrations/social-contacts'])
export class SocialContactsController {
  constructor( private service: SocialContactsService ){}
  @Get('hello')
  async hello() {
    console.log('flag');
    await this.service.hello();
    await this.service.connectLinkedAccount('code','redirectUri');
    return {
      message: 'Testing endpoint',
    };
  }
}
