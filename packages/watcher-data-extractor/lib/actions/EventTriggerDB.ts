import { DataSource, In, Repository } from 'typeorm';
import EventTriggerEntity from '../entities/EventTriggerEntity';
import { BlockEntity } from '@rosen-bridge/scanner';
import { AbstractLogger } from '@rosen-bridge/logger-interface';
import { ExtractedEventTrigger } from '../interfaces/extractedEventTrigger';
import eventTriggerEntity from '../entities/EventTriggerEntity';
import { chunk } from 'lodash-es';
import { dbIdChunkSize } from '../constants';

class EventTriggerDB {
  readonly logger: AbstractLogger;
  private readonly datasource: DataSource;
  private readonly triggerEventRepository: Repository<EventTriggerEntity>;

  constructor(dataSource: DataSource, logger: AbstractLogger) {
    this.datasource = dataSource;
    this.logger = logger;
    this.triggerEventRepository = dataSource.getRepository(EventTriggerEntity);
  }

  /**
   * It stores list of eventTriggers in the dataSource with block id
   * @param eventTriggers
   * @param block
   * @param extractor
   */
  storeEventTriggers = async (
    eventTriggers: Array<ExtractedEventTrigger>,
    block: BlockEntity,
    extractor: string
  ) => {
    if (eventTriggers.length === 0) return true;
    const boxIds = eventTriggers.map((trigger) => trigger.boxId);
    const savedTriggers = await this.triggerEventRepository.findBy({
      boxId: In(boxIds),
      extractor: extractor,
    });
    let success = true;
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const trigger of eventTriggers) {
        const saved = savedTriggers.some((entity) => {
          return entity.boxId === trigger.boxId;
        });
        const entity = {
          txId: trigger.txId,
          eventId: trigger.eventId,
          boxId: trigger.boxId,
          boxSerialized: trigger.boxSerialized,
          block: block.hash,
          height: block.height,
          extractor: extractor,
          WIDs: trigger.WIDs,
          amount: trigger.amount,
          bridgeFee: trigger.bridgeFee,
          fromAddress: trigger.fromAddress,
          toAddress: trigger.toAddress,
          fromChain: trigger.fromChain,
          networkFee: trigger.networkFee,
          sourceChainTokenId: trigger.sourceChainTokenId,
          targetChainTokenId: trigger.targetChainTokenId,
          sourceBlockId: trigger.sourceBlockId,
          toChain: trigger.toChain,
          sourceTxId: trigger.sourceTxId,
          sourceChainHeight: trigger.sourceChainHeight,
        };
        if (!saved) {
          this.logger.info(
            `Storing event trigger [${trigger.boxId}] for event [${trigger.eventId}] at height ${block.height} and extractor ${extractor}`
          );
          await queryRunner.manager.insert(EventTriggerEntity, entity);
        } else {
          this.logger.info(
            `Updating event trigger ${trigger.boxId} for event [${trigger.eventId}] at height ${block.height} and extractor ${extractor}`
          );
          await queryRunner.manager.update(
            EventTriggerEntity,
            {
              boxId: trigger.boxId,
            },
            entity
          );
        }
        this.logger.debug(`Entity: ${JSON.stringify(entity)}`);
      }
      await queryRunner.commitTransaction();
    } catch (e) {
      this.logger.error(
        `An error occurred during store eventTrigger action: ${e}`
      );
      await queryRunner.rollbackTransaction();
      success = false;
    } finally {
      await queryRunner.release();
    }
    return success;
  };

  /**
   * update spendBlock Column of the commitments in the dataBase
   * @param spendId
   * @param block
   * @param extractor
   * @param txId
   */
  spendEventTriggers = async (
    spendId: Array<string>,
    block: BlockEntity,
    extractor: string,
    txId: string
  ): Promise<void> => {
    const spendIdChunks = chunk(spendId, dbIdChunkSize);
    for (const spendIdChunk of spendIdChunks) {
      const updateResult = await this.datasource
        .createQueryBuilder()
        .update(eventTriggerEntity)
        .set({
          spendBlock: block.hash,
          spendHeight: block.height,
          spendTxId: txId,
        })
        .where({ boxId: In(spendIdChunk) })
        .andWhere({ extractor: extractor })
        .execute();

      if (updateResult.affected && updateResult.affected > 0) {
        const spentRows = await this.triggerEventRepository.findBy({
          boxId: In(spendIdChunk),
          spendBlock: block.hash,
        });
        for (const row of spentRows) {
          this.logger.info(
            `Spent trigger [${row.boxId}] of event [${row.eventId}] at height ${block.height}`
          );
          this.logger.debug(`Spent trigger: [${JSON.stringify(row)}]`);
        }
      }
    }
  };

  /**
   * deleting all permits corresponding to the block(id) and extractor(id)
   * @param block
   * @param extractor
   */
  deleteBlock = async (block: string, extractor: string) => {
    this.logger.info(
      `Deleting event triggers at block ${block} and extractor ${extractor}`
    );
    await this.datasource
      .createQueryBuilder()
      .delete()
      .from(EventTriggerEntity)
      .where('extractor = :extractor AND block = :block', {
        block: block,
        extractor: extractor,
      })
      .execute();
    //TODO: should handled null value in spendBlockHeight
    await this.datasource
      .createQueryBuilder()
      .update(EventTriggerEntity)
      .set({ spendBlock: undefined, spendHeight: 0 })
      .where('spendBlock = :block AND block = :block', {
        block: block,
      })
      .execute();
  };
}

export default EventTriggerDB;
