
/* Autogenerated file, do not edit! */

/* eslint-disable */
import {
  type AbiType,
  AztecAddress,
  type AztecAddressLike,
  CompleteAddress,
  Contract,
  type ContractArtifact,
  ContractBase,
  ContractFunctionInteraction,
  type ContractInstanceWithAddress,
  type ContractMethod,
  type ContractStorageLayout,
  type ContractNotes,
  decodeFromAbi,
  DeployMethod,
  EthAddress,
  type EthAddressLike,
  EventSelector,
  type FieldLike,
  Fr,
  type FunctionSelectorLike,
  loadContractArtifact,
  loadContractArtifactForPublic,
  type NoirCompiledContract,
  NoteSelector,
  Point,
  type PublicKey,
  PublicKeys,
  type Wallet,
  type U128Like,
  type WrappedFieldLike,
} from '@aztec/aztec.js';
import GodsHandContractArtifactJson from './target.json' with { type: 'json' };
export const GodsHandContractArtifact = loadContractArtifact(GodsHandContractArtifactJson as NoirCompiledContract);


      export type FundsUnlocked = {
        disaster_hash: FieldLike
organization: AztecAddressLike
amount: (bigint | number)
      }
    

      export type FundsClaimed = {
        disaster_hash: FieldLike
claimer: AztecAddressLike
amount: (bigint | number)
      }
    

      export type DonationMade = {
        disaster_hash: FieldLike
donor: AztecAddressLike
amount: (bigint | number)
      }
    

/**
 * Type-safe interface for contract GodsHand;
 */
export class GodsHandContract extends ContractBase {
  
  private constructor(
    instance: ContractInstanceWithAddress,
    wallet: Wallet,
  ) {
    super(instance, GodsHandContractArtifact, wallet);
  }
  

  
  /**
   * Creates a contract instance.
   * @param address - The deployed contract's address.
   * @param wallet - The wallet to use when interacting with the contract.
   * @returns A promise that resolves to a new Contract instance.
   */
  public static async at(
    address: AztecAddress,
    wallet: Wallet,
  ) {
    return Contract.at(address, GodsHandContract.artifact, wallet) as Promise<GodsHandContract>;
  }

  
  /**
   * Creates a tx to deploy a new instance of this contract.
   */
  public static deploy(wallet: Wallet, eth_token: AztecAddressLike, agent: AztecAddressLike, vote_threshold: (bigint | number)) {
    return new DeployMethod<GodsHandContract>(PublicKeys.default(), wallet, GodsHandContractArtifact, GodsHandContract.at, Array.from(arguments).slice(1));
  }

  /**
   * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
   */
  public static deployWithPublicKeys(publicKeys: PublicKeys, wallet: Wallet, eth_token: AztecAddressLike, agent: AztecAddressLike, vote_threshold: (bigint | number)) {
    return new DeployMethod<GodsHandContract>(publicKeys, wallet, GodsHandContractArtifact, GodsHandContract.at, Array.from(arguments).slice(2));
  }

  /**
   * Creates a tx to deploy a new instance of this contract using the specified constructor method.
   */
  public static deployWithOpts<M extends keyof GodsHandContract['methods']>(
    opts: { publicKeys?: PublicKeys; method?: M; wallet: Wallet },
    ...args: Parameters<GodsHandContract['methods'][M]>
  ) {
    return new DeployMethod<GodsHandContract>(
      opts.publicKeys ?? PublicKeys.default(),
      opts.wallet,
      GodsHandContractArtifact,
      GodsHandContract.at,
      Array.from(arguments).slice(1),
      opts.method ?? 'constructor',
    );
  }
  

  
  /**
   * Returns this contract's artifact.
   */
  public static get artifact(): ContractArtifact {
    return GodsHandContractArtifact;
  }

  /**
   * Returns this contract's artifact with public bytecode.
   */
  public static get artifactForPublic(): ContractArtifact {
    return loadContractArtifactForPublic(GodsHandContractArtifactJson as NoirCompiledContract);
  }
  

  public static get storage(): ContractStorageLayout<'config' | 'disaster_info' | 'total_donations' | 'user_donations' | 'vote_count' | 'unlocked_funds' | 'contract_balance'> {
      return {
        config: {
      slot: new Fr(1n),
    },
disaster_info: {
      slot: new Fr(5n),
    },
total_donations: {
      slot: new Fr(6n),
    },
user_donations: {
      slot: new Fr(7n),
    },
vote_count: {
      slot: new Fr(8n),
    },
unlocked_funds: {
      slot: new Fr(9n),
    },
contract_balance: {
      slot: new Fr(10n),
    }
      } as ContractStorageLayout<'config' | 'disaster_info' | 'total_donations' | 'user_donations' | 'vote_count' | 'unlocked_funds' | 'contract_balance'>;
    }
    

  public static get notes(): ContractNotes<'ValueNote'> {
    return {
      ValueNote: {
          id: new NoteSelector(0),
        }
    } as ContractNotes<'ValueNote'>;
  }
  

  /** Type-safe wrappers for the public methods exposed by the contract. */
  public declare methods: {
    
    /** claim(disaster_hash: field) */
    claim: ((disaster_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** constructor(eth_token: struct, agent: struct, vote_threshold: integer) */
    constructor: ((eth_token: AztecAddressLike, agent: AztecAddressLike, vote_threshold: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** create_disaster(disaster_hash: field, estimated_amount: integer) */
    create_disaster: ((disaster_hash: FieldLike, estimated_amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** deactivate_disaster(disaster_hash: field) */
    deactivate_disaster: ((disaster_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** donate(disaster_hash: field, amount: integer) */
    donate: ((disaster_hash: FieldLike, amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_config() */
    get_config: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_contract_balance(disaster_hash: field) */
    get_contract_balance: ((disaster_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_disaster_info(disaster_hash: field) */
    get_disaster_info: ((disaster_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_total_donations(disaster_hash: field) */
    get_total_donations: ((disaster_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_unlocked_funds(disaster_hash: field, org_address: struct) */
    get_unlocked_funds: ((disaster_hash: FieldLike, org_address: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_user_donation(disaster_hash: field, user: struct) */
    get_user_donation: ((disaster_hash: FieldLike, user: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** get_vote_count(disaster_hash: field) */
    get_vote_count: ((disaster_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** public_dispatch(selector: field) */
    public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** sync_private_state() */
    sync_private_state: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** unlock_funds(disaster_hash: field, org_address: struct, amount: integer) */
    unlock_funds: ((disaster_hash: FieldLike, org_address: AztecAddressLike, amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;

    /** vote(disaster_hash: field, org_address: struct, vote_type: integer) */
    vote: ((disaster_hash: FieldLike, org_address: AztecAddressLike, vote_type: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
  };

  
    public static get events(): { FundsUnlocked: {abiType: AbiType, eventSelector: EventSelector, fieldNames: string[] }, FundsClaimed: {abiType: AbiType, eventSelector: EventSelector, fieldNames: string[] }, DonationMade: {abiType: AbiType, eventSelector: EventSelector, fieldNames: string[] } } {
    return {
      FundsUnlocked: {
        abiType: {
    "kind": "struct",
    "fields": [
        {
            "name": "disaster_hash",
            "type": {
                "kind": "field"
            }
        },
        {
            "name": "organization",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "inner",
                        "type": {
                            "kind": "field"
                        }
                    }
                ],
                "path": "aztec::protocol_types::address::aztec_address::AztecAddress"
            }
        },
        {
            "name": "amount",
            "type": {
                "kind": "integer",
                "sign": "unsigned",
                "width": 64
            }
        }
    ],
    "path": "GodsHand::FundsUnlocked"
},
        eventSelector: EventSelector.fromString("0xba27185d"),
        fieldNames: ["disaster_hash","organization","amount"],
      },
FundsClaimed: {
        abiType: {
    "kind": "struct",
    "fields": [
        {
            "name": "disaster_hash",
            "type": {
                "kind": "field"
            }
        },
        {
            "name": "claimer",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "inner",
                        "type": {
                            "kind": "field"
                        }
                    }
                ],
                "path": "aztec::protocol_types::address::aztec_address::AztecAddress"
            }
        },
        {
            "name": "amount",
            "type": {
                "kind": "integer",
                "sign": "unsigned",
                "width": 64
            }
        }
    ],
    "path": "GodsHand::FundsClaimed"
},
        eventSelector: EventSelector.fromString("0x39ad3d2a"),
        fieldNames: ["disaster_hash","claimer","amount"],
      },
DonationMade: {
        abiType: {
    "kind": "struct",
    "fields": [
        {
            "name": "disaster_hash",
            "type": {
                "kind": "field"
            }
        },
        {
            "name": "donor",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "inner",
                        "type": {
                            "kind": "field"
                        }
                    }
                ],
                "path": "aztec::protocol_types::address::aztec_address::AztecAddress"
            }
        },
        {
            "name": "amount",
            "type": {
                "kind": "integer",
                "sign": "unsigned",
                "width": 64
            }
        }
    ],
    "path": "GodsHand::DonationMade"
},
        eventSelector: EventSelector.fromString("0x9d3b27e3"),
        fieldNames: ["disaster_hash","donor","amount"],
      }
    };
  }
  
}
