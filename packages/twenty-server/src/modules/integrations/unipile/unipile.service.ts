import { Injectable } from '@nestjs/common';

@Injectable()
export class UnipileService {
  getHello() {
    return { message: 'Hola desde Unipile endpoint!' };
  }
}
