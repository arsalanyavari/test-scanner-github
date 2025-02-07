interface KoiosBlock {
  hash: string;
  block_height: number;
  block_time: number;
}

interface KoiosBlockInfo {
  hash: string;
  block_height: number;
  parent_hash: string;
  child_hash?: string;
}

interface PaymentAddr {
  bech32: string;
  cred: string;
}

interface Asset {
  policy_id: string;
  asset_name: string;
  quantity: string;
}

interface UTXO {
  payment_addr: PaymentAddr;
  stake_addr?: string | null;
  tx_hash: string;
  tx_index: number;
  value: string;
  asset_list: Array<Asset>;
}

interface Withdrawal {
  amount: string;
  stake_addr: {
    bech32: string;
  };
}

interface MetaData {
  [key: string]: Record<string, unknown>;
}

interface Certificate {
  index?: number | null;
  type: string;
  info: Record<string, unknown>;
}

interface NativeScript {
  script_hash: string;
  script_json: Record<string, unknown>;
}

interface PlutusContract {
  address: string;
  script_hash: string;
  bytecode: string;
}

interface KoiosTransaction {
  tx_hash: string;
  block_hash: string;
  block_height: number;
  epoch_no: number;
  epoch_slot: number;
  tx_timestamp: number;
  tx_block_index: number;
  tx_size: number;
  total_output: string;
  fee: string;
  deposit: string;
  invalid_before?: number | null;
  invalid_after?: number | null;
  collaterals: Array<UTXO>;
  inputs: Array<UTXO>;
  outputs: Array<UTXO>;
  withdrawals: Array<Withdrawal>;
  assets_minted: Array<Asset>;
  metadata: MetaData;
  certificates: Array<Certificate>;
  native_scripts: Array<NativeScript>;
  plutus_contracts: Array<PlutusContract>;
}

export { KoiosBlock, KoiosBlockInfo, KoiosTransaction };
