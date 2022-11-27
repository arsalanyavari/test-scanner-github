import { AbstractExtractor, BlockEntity } from '@rosen-bridge/scanner';
import { AuxiliaryData, TxBabbage, TxOut } from '@cardano-ogmios/schema';
import { DataSource } from 'typeorm';
import { RosenTokens, TokenMap } from '@rosen-bridge/tokens';
import { ObservationEntityAction } from '../../actions/db';
import { getDictValue, JsonObject } from '../utils';
import { CARDANO_NATIVE_TOKEN } from '../const';
import { CardanoRosenData } from '../../interfaces/rosen';
import { ExtractedObservation } from '../../interfaces/extractedObservation';
import { Buffer } from 'buffer';
import { blake2b } from 'blakejs';

export class CardanoOgmiosObservationExtractor extends AbstractExtractor<TxBabbage> {
  private readonly dataSource: DataSource;
  private readonly tokens: TokenMap;
  private readonly actions: ObservationEntityAction;
  private readonly bankAddress: string;
  static readonly FROM_CHAIN: string = 'cardano';

  constructor(dataSource: DataSource, tokens: RosenTokens, address: string) {
    super();
    this.bankAddress = address;
    this.dataSource = dataSource;
    this.tokens = new TokenMap(tokens);
    this.actions = new ObservationEntityAction(dataSource);
  }

  getObjectKeyAsStringOrUndefined = (
    val: JsonObject,
    key: string
  ): string | undefined => {
    if (Object.prototype.hasOwnProperty.call(val, key)) {
      const res = val[key];
      if (typeof res === 'string') return res;
    }
    return undefined;
  };

  /**
   * get Id for current extractor
   */
  getId = () => 'ergo-cardano-ogmios-extractor';

  /**
   * calculate transformation token id in both sides and transfer amount
   * @param box
   * @param toChain
   */
  getTokenDetail = (
    box: TxOut,
    toChain: string
  ): { from: string; to: string; amount: string } | undefined => {
    let res: { from: string; to: string; amount: string } | undefined =
      undefined;
    if (box.value.assets) {
      const asset = box.value.assets;
      Object.keys(asset).map((tokenKey) => {
        let token = this.tokens.search(
          CardanoOgmiosObservationExtractor.FROM_CHAIN,
          { policyId: tokenKey }
        );
        if (tokenKey.indexOf('.') != -1) {
          const parts = tokenKey.split('.');
          token = this.tokens.search(
            CardanoOgmiosObservationExtractor.FROM_CHAIN,
            {
              policyId: parts[0],
              assetName: parts[1],
            }
          );
        }
        if (token.length > 0) {
          res = {
            from: this.tokens.getID(
              token[0],
              CardanoOgmiosObservationExtractor.FROM_CHAIN
            ),
            to: this.tokens.getID(token[0], toChain),
            amount: asset[tokenKey].toString(),
          };
        }
      });
    }
    if (res) return res;
    const lovelace = this.tokens.search(
      CardanoOgmiosObservationExtractor.FROM_CHAIN,
      {
        [this.tokens.getIdKey(CardanoOgmiosObservationExtractor.FROM_CHAIN)]:
          CARDANO_NATIVE_TOKEN,
      }
    );
    if (lovelace.length) {
      return {
        from: CARDANO_NATIVE_TOKEN,
        to: this.tokens.getID(lovelace[0], toChain),
        amount: box.value.coins.toString(),
      };
    }
  };

  /**
   * returns rosenData object if the box format is like rosen bridge observations otherwise returns undefined
   * @param metaData
   */
  getRosenData = (metaData: AuxiliaryData): CardanoRosenData | undefined => {
    try {
      const blob = metaData.body.blob;
      if (blob) {
        const value = getDictValue(blob['0']);
        if (value) {
          const toChain = this.getObjectKeyAsStringOrUndefined(value, 'to');
          const bridgeFee = this.getObjectKeyAsStringOrUndefined(
            value,
            'bridgeFee'
          );
          const networkFee = this.getObjectKeyAsStringOrUndefined(
            value,
            'networkFee'
          );
          const toAddress = this.getObjectKeyAsStringOrUndefined(
            value,
            'toAddress'
          );
          const fromAddress = (value.fromAddress as Array<string>).join('');
          if (toChain && bridgeFee && networkFee && toAddress && fromAddress) {
            return {
              toChain,
              bridgeFee,
              networkFee,
              toAddress,
              fromAddress,
            };
          }
        }
      }
    } catch {
      /* empty */
    }
    return undefined;
  };

  /**
   * gets block id and transactions corresponding to the block and saves if they are valid rosen
   *  transactions and in case of success return true and in case of failure returns false
   * @param block
   * @param txs
   */
  processTransactions = (
    txs: Array<TxBabbage>,
    block: BlockEntity
  ): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      try {
        const observations: Array<ExtractedObservation> = [];
        for (const transaction of txs) {
          if (transaction.metadata !== null) {
            try {
              const data = this.getRosenData(transaction.metadata);
              const paymentOutput = transaction.body.outputs[0];
              if (
                data &&
                paymentOutput &&
                paymentOutput.address === this.bankAddress
              ) {
                const transferAsset = this.getTokenDetail(
                  paymentOutput,
                  data.toChain
                );
                if (transferAsset) {
                  const requestId = Buffer.from(
                    blake2b(transaction.id, undefined, 32)
                  ).toString('hex');
                  observations.push({
                    fromChain: CardanoOgmiosObservationExtractor.FROM_CHAIN,
                    toChain: data.toChain,
                    amount: transferAsset.amount,
                    sourceChainTokenId: transferAsset.from,
                    targetChainTokenId: transferAsset.to,
                    sourceTxId: transaction.id,
                    bridgeFee: data.bridgeFee,
                    networkFee: data.networkFee,
                    sourceBlockId: block.hash,
                    requestId: requestId,
                    toAddress: data.toAddress,
                    fromAddress: data.fromAddress,
                  });
                }
              }
            } catch (e) {
              console.log('error during observing cardano transactions', e);
            }
          }
        }
        this.actions
          .storeObservations(observations, block, this.getId())
          .then((status) => {
            resolve(status);
          })
          .catch((e) => {
            console.log(`An error occurred during store observations: ${e}`);
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
