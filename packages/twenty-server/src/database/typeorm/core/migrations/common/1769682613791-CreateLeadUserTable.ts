import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLeadUserTable1769682613791 implements MigrationInterface {
    name = 'CreateLeadUserTable1769682613791'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "core"."lead_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source" "core"."lead_user_source_enum" NOT NULL, "providerAccountId" character varying, "username" character varying, "accessToken" character varying, "email" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "accountId" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "workspace_id" uuid NOT NULL, CONSTRAINT "PK_d95426f22d7a273db0f97ce192a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1fa529395da2b9da65924b3c25" ON "core"."lead_user" ("email", "source") `);
        await queryRunner.query(`ALTER TABLE "core"."lead_user" ADD CONSTRAINT "FK_8af44dd084469851287dfa6192b" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."lead_user" ADD CONSTRAINT "FK_c5066f7c57f6a4592a82f53d982" FOREIGN KEY ("workspace_id") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."lead_user" DROP CONSTRAINT "FK_c5066f7c57f6a4592a82f53d982"`);
        await queryRunner.query(`ALTER TABLE "core"."lead_user" DROP CONSTRAINT "FK_8af44dd084469851287dfa6192b"`);
        await queryRunner.query(`DROP INDEX "core"."IDX_1fa529395da2b9da65924b3c25"`);
        await queryRunner.query(`DROP TABLE "core"."lead_user"`);
    }

}
