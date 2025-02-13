import { DataSource } from 'typeorm';
import { Buffer } from 'buffer';
import { blake2b } from 'blakejs';
import { ExtractedObservation } from '../../interfaces/extractedObservation';
import { ObservationEntityAction } from '../../actions/db';
import { KoiosTransaction } from '../../interfaces/koiosTransaction';
import { AbstractExtractor, BlockEntity } from '@rosen-bridge/scanner';
import { AbstractLogger, DummyLogger } from '@rosen-bridge/logger-interface';
import { RosenTokens, TokenMap } from '@rosen-bridge/tokens';
import { CardanoKoiosRosenExtractor } from '@rosen-bridge/rosen-extractor';

export class CardanoKoiosObservationExtractor extends AbstractExtractor<KoiosTransaction> {
  readonly logger: AbstractLogger;
  private readonly dataSource: DataSource;
  private readonly tokens: TokenMap;
  private readonly actions: ObservationEntityAction;
  private readonly extractor: CardanoKoiosRosenExtractor;
  static readonly FROM_CHAIN: string = 'cardano';

  constructor(
    dataSource: DataSource,
    tokens: RosenTokens,
    address: string,
    logger?: AbstractLogger
  ) {
    super();
    this.dataSource = dataSource;
    this.tokens = new TokenMap(tokens);
    this.logger = logger ? logger : new DummyLogger();
    this.actions = new ObservationEntityAction(dataSource, this.logger);
    this.extractor = new CardanoKoiosRosenExtractor(
      address,
      tokens,
      this.logger
    );
  }

  /**
   * get Id for current extractor
   */
  getId = () => 'ergo-cardano-koios-extractor';

  /**
   * gets block id and transactions corresponding to the block and saves if they are valid rosen
   *  transactions and in case of success return true and in case of failure returns false
   * @param block
   * @param txs
   */
  processTransactions = (
    txs: Array<KoiosTransaction>,
    block: BlockEntity
  ): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      try {
        const observations: Array<ExtractedObservation> = [];
        txs.forEach((transaction) => {
          const data = this.extractor.get(transaction);
          if (data) {
            const requestId = Buffer.from(
              blake2b(transaction.tx_hash, undefined, 32)
            ).toString('hex');
            observations.push({
              fromChain: CardanoKoiosObservationExtractor.FROM_CHAIN,
              toChain: data.toChain,
              amount: data.amount,
              sourceChainTokenId: data.sourceChainTokenId,
              targetChainTokenId: data.targetChainTokenId,
              sourceTxId: data.sourceTxId,
              bridgeFee: data.bridgeFee,
              networkFee: data.networkFee,
              sourceBlockId: block.hash,
              requestId: requestId,
              toAddress: data.toAddress,
              fromAddress: data.fromAddress,
            });
          }
        });
        this.actions
          .storeObservations(observations, block, this.getId())
          .then((status) => {
            resolve(status);
          })
          .catch((e) => {
            this.logger.error(
              `An error occurred during store observations: ${e}`
            );
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * fork one block and remove all stored information for this block
   * @param hash: block hash
   */
  forkBlock = async (hash: string): Promise<void> => {
    await this.actions.deleteBlockObservation(hash, this.getId());
  };

  /**
   * Extractor box initialization
   * No action needed in cardano extractors
   */
  initializeBoxes = async () => {
    return;
  };
}
