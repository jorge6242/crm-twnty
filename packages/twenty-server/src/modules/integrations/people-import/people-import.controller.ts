import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthenticatedRequest } from 'src/engine/api/rest/types/authenticated-request';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { ConflictStrategy } from 'src/modules/integrations/people-import/dto/people-import-options.dto';
import { ImportSummaryDto } from 'src/modules/integrations/people-import/dto/people-import-result.dto';
import { PeopleImportService } from 'src/modules/integrations/people-import/people-import.service';
import { createEmptySummary } from 'src/modules/integrations/people-import/people-import.utils';

/**
 * REST controller for importing people from CSV files.
 * Exposes a single POST endpoint that accepts multipart/form-data uploads.
 */
@UseGuards(JwtAuthGuard)
@Controller(['metadata/people-import', 'rest/metadata/people-import'])
export class PeopleImportController {
  constructor(private readonly peopleImportService: PeopleImportService) {}

  /**
   * Receives a CSV file and delegates the import to `PeopleImportService`.
   *
   * @param req              - Authenticated request containing the workspaceId
   * @param file             - Uploaded CSV file (multipart/form-data, field "file")
   * @param conflictStrategy - How to handle duplicate emails: `merge`, `skip`, or `create`
   * @returns An `ImportSummaryDto` with per-row results and counters
   */
  @Post('csv')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Query('conflictStrategy') conflictStrategy: ConflictStrategy = 'merge',
  ): Promise<ImportSummaryDto> {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return createEmptySummary(
        'Missing workspaceId — include it in your API Key or token',
      );
    }

    if (!file) {
      return createEmptySummary(
        'No file uploaded — use multipart/form-data with field "file"',
      );
    }

    return this.peopleImportService.importFromCsv(
      workspaceId,
      file.buffer,
      conflictStrategy,
    );
  }
}
