import { MigrationInterface, QueryRunner } from 'typeorm';

export class migration1673422203223 implements MigrationInterface {
  name = 'migration1673422203223';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_trigger_entity" ADD "eventId" varchar`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_trigger_entity" DROP COLUMN "eventId"`
    );
  }
}