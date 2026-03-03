import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonEnrichmentTrackingTable1772274000000
  implements MigrationInterface
{
  name = 'CreatePersonEnrichmentTrackingTable1772274000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "core"."personEnrichmentTracking_provider_enum" AS ENUM('full_enrich')`,
    );
    await queryRunner.query(
      `CREATE TYPE "core"."personEnrichmentTracking_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "core"."personEnrichmentTracking" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "personId" uuid NOT NULL,
        "provider" "core"."personEnrichmentTracking_provider_enum" NOT NULL,
        "status" "core"."personEnrichmentTracking_status_enum" NOT NULL DEFAULT 'pending',
        "enrichmentData" jsonb,
        "errorMessage" text,
        "lastEnrichedAt" TIMESTAMP WITH TIME ZONE,
        "enrichedBy" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_personEnrichmentTracking_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_personEnrichmentTracking_workspace_person" ON "core"."personEnrichmentTracking" ("workspaceId", "personId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."personEnrichmentTracking" ADD CONSTRAINT "FK_personEnrichmentTracking_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."personEnrichmentTracking" ADD CONSTRAINT "FK_personEnrichmentTracking_user" FOREIGN KEY ("enrichedBy") REFERENCES "core"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."personEnrichmentTracking" DROP CONSTRAINT "FK_personEnrichmentTracking_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."personEnrichmentTracking" DROP CONSTRAINT "FK_personEnrichmentTracking_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_personEnrichmentTracking_workspace_person"`,
    );
    await queryRunner.query(`DROP TABLE "core"."personEnrichmentTracking"`);
    await queryRunner.query(
      `DROP TYPE "core"."personEnrichmentTracking_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "core"."personEnrichmentTracking_provider_enum"`,
    );
  }
}
