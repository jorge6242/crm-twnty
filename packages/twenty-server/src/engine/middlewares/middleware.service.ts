import { Injectable } from '@nestjs/common';

import { type Request, type Response } from 'express';
import { type APP_LOCALES, SOURCE_LOCALE } from 'twenty-shared/translations';
import { isDefined } from 'twenty-shared/utils';

import { AuthException } from 'src/engine/core-modules/auth/auth.exception';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { getAuthExceptionRestStatus } from 'src/engine/core-modules/auth/utils/get-auth-exception-rest-status.util';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { ErrorCode } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { INTERNAL_SERVER_ERROR } from 'src/engine/middlewares/constants/default-error-message.constant';
import { bindDataToRequestObject } from 'src/engine/utils/bind-data-to-request-object.util';
import {
    handleException,
    handleExceptionAndConvertToGraphQLError,
} from 'src/engine/utils/global-exception-handler.util';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { type CustomException } from 'src/utils/custom-exception';

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly workspaceStorageCacheService: WorkspaceCacheStorageService,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly dataSourceService: DataSourceService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  public isTokenPresent(request: Request): boolean {
    const token = this.jwtWrapperService.extractJwtFromRequest()(request);

    return !!token;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeRestResponseOnExceptionCaught(res: Response, error: any) {
    const statusCode = this.getStatus(error);
    // capture and handle custom exceptions (defensive)
    try {
      handleException({
        exception: error as CustomException,
        exceptionHandlerService: this.exceptionHandlerService,
        statusCode,
      });
    } catch (handlerErr) {
      // ensure we log any errors from the exception handler itself
      // eslint-disable-next-line no-console
      console.error('Exception handler failed while processing error:', handlerErr);
    }

    // Always log the original error server-side to aid debugging
    // eslint-disable-next-line no-console
    console.error('REST error caught by MiddlewareService:', {
      statusCode,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    // Build a safe response body with fallbacks in case stringify fails
    let body: string;
    try {
      body = JSON.stringify({
        statusCode,
        messages: [error?.message || INTERNAL_SERVER_ERROR],
        error: error?.code || ErrorCode.INTERNAL_SERVER_ERROR,
      });
    } catch (stringifyErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to stringify error response body:', stringifyErr);
      body = JSON.stringify({
        statusCode,
        messages: [INTERNAL_SERVER_ERROR],
        error: ErrorCode.INTERNAL_SERVER_ERROR,
      });
    }

    try {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.write(body);
      res.end();
    } catch (resErr) {
      // Final fallback: log and attempt to end response
      // eslint-disable-next-line no-console
      console.error('Failed to write REST error response:', resErr);
      try {
        res.statusCode = statusCode;
        res.end();
      } catch (_) {
        // ignore
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeGraphqlResponseOnExceptionCaught(res: Response, error: any) {
    let errors;

    if (error instanceof AuthException) {
      try {
        const authFilter = new AuthGraphqlApiExceptionFilter();

        authFilter.catch(error);
      } catch (transformedError) {
        errors = [transformedError];
      }
    } else {
      errors = [
        handleExceptionAndConvertToGraphQLError(
          error as Error,
          this.exceptionHandlerService,
        ),
      ];
    }

    const statusCode = 200;

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
    });

    res.write(
      JSON.stringify({
        errors,
      }),
    );

    res.end();
  }

  public async hydrateRestRequest(request: Request) {
    const data = await this.accessTokenService.validateTokenByRequest(request);
    const metadataVersion = data.workspace
      ? await this.workspaceStorageCacheService.getMetadataVersion(
          data.workspace.id,
        )
      : undefined;

    const dataSourcesMetadata = data.workspace
      ? await this.dataSourceService.getDataSourcesMetadataFromWorkspaceId(
          data.workspace.id,
        )
      : undefined;

    if (!dataSourcesMetadata || dataSourcesMetadata.length === 0) {
      throw new Error('No data sources found');
    }

    bindDataToRequestObject(data, request, metadataVersion);
  }

  public async hydrateGraphqlRequest(request: Request) {
    if (!this.isTokenPresent(request)) {
      request.locale =
        (request.headers['x-locale'] as keyof typeof APP_LOCALES) ??
        SOURCE_LOCALE;

      return;
    }

    const data = await this.accessTokenService.validateTokenByRequest(request);
    const metadataVersion = data.workspace
      ? await this.workspaceStorageCacheService.getMetadataVersion(
          data.workspace.id,
        )
      : undefined;

    bindDataToRequestObject(data, request, metadataVersion);
  }

  private hasErrorStatus(error: unknown): error is { status: number } {
    return isDefined((error as { status: number })?.status);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getStatus(error: any): number {
    if (this.hasErrorStatus(error)) {
      return error.status;
    }

    if (error instanceof AuthException) {
      return getAuthExceptionRestStatus(error);
    }

    return 500;
  }
}
