import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

const username = "jorge6242@gmail.com"
const password = "Exirion.05*"
const provider = "LINKEDIN"

@Injectable()
export class  SocialContactsService {
  private readonly logger = new Logger( SocialContactsService.name);

  constructor(private readonly http: HttpService) {}

  async hello(): Promise<any> {
    try {
      const resp = await firstValueFrom(this.http.get('/accounts'));
      console.log('resp ', resp.data);
      return resp.data;
    } catch (err) {
      this.logger.error('Unipile hello failed', err as any);
      throw err;
    }
  }

  async get(path: string, params?: Record<string, any>) {
    try {
      const resp = await firstValueFrom(this.http.get(path, { params }));
      return resp.data;
    } catch (err) {
      this.logger.error(`Unipile GET ${path} failed`, err as any);
      throw err;
    }
  }

  async post(path: string, body: any) {
    try {
      const resp = await firstValueFrom(this.http.post(path, body));
      return resp.data;
    } catch (err) {
      this.logger.error(`Unipile POST ${path} failed`, err as any);
      throw err;
    }
  }

  async connectLinkedAccount(oauthCode: string, redirectUri: string) {
    try {
      const resp = await firstValueFrom(
        this.http.post('/accounts', {
          username,
          password,
          provider,
        }),
      );
      console.log('connectLinkedAccount resp ', resp.data);
      return resp.data;
    } catch (err) {
      this.logger.error(`Unipile connectLinkedAccount failed`, err as any);
      throw err;
    }
  }
}
