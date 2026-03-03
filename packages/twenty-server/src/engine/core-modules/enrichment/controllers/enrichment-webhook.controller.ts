import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';

import { FullEnrichWebhookPayload } from 'src/engine/core-modules/enrichment/dtos/fullenrich-webhook.dto';
import { PeopleEnrichmentService } from 'src/engine/core-modules/enrichment/services/people-enrichment.service';

@Controller('webhooks/fullenrich')
export class EnrichmentWebhookController {
  private readonly logger = new Logger(EnrichmentWebhookController.name);

  constructor(
    private readonly peopleEnrichmentService: PeopleEnrichmentService,
  ) {}

  /**
   * Webhook endpoint for FullEnrich to notify when individual contacts are enriched
   * This endpoint is called for each contact as it completes (30-90 seconds per contact)
   */
  @Post('enrichment-completed')
  @HttpCode(HttpStatus.OK)
  async handleEnrichmentCompleted(
    @Body() payload: FullEnrichWebhookPayload,
  ): Promise<{ success: boolean }> {
    this.logger.log(
      `Received FullEnrich webhook for enrichment ${payload.id}, status: ${payload.status}`,
    );

    try {
      // Process each contact in the webhook payload
      for (const contactData of payload.data) {
        const personId = contactData.custom?.personId;

        if (!personId) {
          this.logger.warn(
            'Received webhook data without personId in custom field',
          );
          continue;
        }

        this.logger.log(
          `Processing enrichment result for person ${personId}`,
        );

        // Process the individual enrichment result
        await this.peopleEnrichmentService.processIndividualEnrichmentResult(
          personId,
          payload.id,
          contactData,
        );

        this.logger.log(
          `Successfully processed enrichment for person ${personId}`,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to process FullEnrich webhook for enrichment ${payload.id}:`,
        error,
      );

      // Still return 200 to prevent FullEnrich from retrying
      // The error is logged and can be handled by the fallback cronjob
      return { success: false };
    }
  }
}
