import {
    createPublicClient,
    http,
    encodePacked,
    erc20Abi,
    parseUnits,
    formatUnits,
    hexToBigInt,
    maxUint256,
    parseErc6492Signature,
  } from "viem";
  import { arbitrumSepolia } from "viem/chains";
  import { privateKeyToAccount } from "viem/accounts";
  import {
    createBundlerClient,
    toSimple7702SmartAccount,
  } from "viem/account-abstraction";
  
  // Paymaster configuration
  const PAYMASTER_V08_ADDRESS = "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966"; // Testnets
  
  // EIP-2612 permit ABI for USDC
  const eip2612Abi = [
    ...erc20Abi,
    {
      name: "nonces",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      name: "version",
      inputs: [],
      outputs: [{ type: "string" }],
      stateMutability: "view",
      type: "function",
    },
  ];
  
  // Sign permit for USDC gas payment
  async function signPermit({
    tokenAddress,
    client,
    account,
    spenderAddress,
    permitAmount,
  }: {
    tokenAddress: `0x${string}`;
    client: any;
    account: any;
    spenderAddress: `0x${string}`;
    permitAmount: bigint;
  }) {
    const domain = {
      name: await client.readContract({
        address: tokenAddress,
        abi: eip2612Abi,
        functionName: 'name',
      }),
      version: await client.readContract({
        address: tokenAddress,
        abi: eip2612Abi,
        functionName: 'version',
      }),
      chainId: client.chain.id,
      verifyingContract: tokenAddress,
    };
    const message = {
      owner: account.address,
      spender: spenderAddress,
      value: permitAmount.toString(),
      nonce: (await client.readContract({
        address: tokenAddress,
        abi: eip2612Abi,
        functionName: 'nonces',
        args: [account.address],
      })).toString(),
      deadline: maxUint256.toString(), // 4337 constraint: no block.timestamp
    };
    const types = {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  
    // 7702 smart account provides account.signTypedData (wrapped ERC-6492)
    const wrappedSig = await account.signTypedData({
      primaryType: "Permit",
      domain,
      types,
      message,
    });
  
    const isValid = await client.verifyTypedData({
      address: account.address,
      primaryType: "Permit",
      domain,
      types,
      message,
      signature: wrappedSig,
    });
    if (!isValid) throw new Error("Invalid permit signature");
  
    // unwrap ERC-6492 to raw ECDSA
    const { signature } = parseErc6492Signature(wrappedSig);
    return signature;
  }
  
  // Create paymaster configuration for USDC gas payment
  export function createPaymasterConfig({
    usdcAddress,
    account,
    client,
  }: {
    usdcAddress: `0x${string}`;
    account: any;
    client: any;
  }) {
    return {
      async getPaymasterData() {
        const permitAmount = 10_000_000n; // 10 USDC allowance so you don't re-permit every time
        const permitSignature = await signPermit({
          tokenAddress: usdcAddress,
          account,
          client,
          spenderAddress: PAYMASTER_V08_ADDRESS,
          permitAmount,
        });
  
        const paymasterData = encodePacked(
          ["uint8", "address", "uint256", "bytes"],
          [0, usdcAddress, permitAmount, permitSignature]
        );
  
        return {
          paymaster: PAYMASTER_V08_ADDRESS,
          paymasterData,
          paymasterVerificationGasLimit: 200000n,
          paymasterPostOpGasLimit: 15000n,
          isFinal: true,
        };
      },
    };
  }
  
  // Create bundler client with paymaster support - matching index.js exactly
  export function createBundlerClientWithPaymaster({
    account,
    client,
    paymaster,
  }: {
    account: any;
    client: any;
    paymaster: any;
  }) {
    return createBundlerClient({
      account,
      client,
      paymaster,
      userOperation: {
        estimateFeesPerGas: async ({ bundlerClient }: { bundlerClient: any }) => {
          const { standard: fees } = await bundlerClient.request({
            method: "pimlico_getUserOperationGasPrice",
          });
          return {
            maxFeePerGas: hexToBigInt(fees.maxFeePerGas),
            maxPriorityFeePerGas: hexToBigInt(fees.maxPriorityFeePerGas),
          };
        },
      },
      transport: http(`https://public.pimlico.io/v2/${client.chain.id}/rpc`),
    });
  }
  
  // Create 7702 smart account - matching index.js exactly
  export async function create7702SmartAccount({
    privateKey,
    client,
  }: {
    privateKey: string;
    client: any;
  }) {
    // Ensure private key has 0x prefix
    const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    
    // Create owner account from private key
    const owner = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
    
    // Create 7702 smart account
    const account = await toSimple7702SmartAccount({ client, owner });
    return { account, owner };
  }
  