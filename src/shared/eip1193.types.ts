import { z } from 'zod'

//
// EIP-1193 RPC Method Constants
//

// Declarative method categorization for UI behavior
export const METHODS_REQUIRING_USER_INTERACTION: readonly string[] = [
  'eth_sendTransaction',
  'eth_signTypedData_v4',
  'personal_sign'
  // 'wallet_switchEthereumChain', // TODO: switching chains MIGHT require dialog if it's a new connection.
  // 'wallet_connect' // wallet_connect is handled in the parent for interaction; the actual RPC to the child doesn't open the widget again.
] as const

// Readonly RPC methods that can be handled via direct RPC calls
export const READONLY_RPC_METHODS = {
  ETH_ESTIMATE_GAS: 'eth_estimateGas',
  ETH_GAS_PRICE: 'eth_gasPrice',
  ETH_GET_BALANCE: 'eth_getBalance',
  ETH_GET_TRANSACTION_COUNT: 'eth_getTransactionCount',
  ETH_GET_TRANSACTION_RECEIPT: 'eth_getTransactionReceipt',
  ETH_GET_TRANSACTION_BY_HASH: 'eth_getTransactionByHash',
  ETH_CALL: 'eth_call',
  ETH_GET_CODE: 'eth_getCode',
  ETH_GET_STORAGE_AT: 'eth_getStorageAt',
  ETH_BLOCK_NUMBER: 'eth_blockNumber',
  ETH_GET_BLOCK_BY_NUMBER: 'eth_getBlockByNumber',
  ETH_GET_BLOCK_BY_HASH: 'eth_getBlockByHash',
  ETH_GET_LOGS: 'eth_getLogs'
} as const

export type ReadonlyRpcMethod = (typeof READONLY_RPC_METHODS)[keyof typeof READONLY_RPC_METHODS]

//
// EIP-1193 Standard Error Codes
// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1193.md#provider-errors
//

export const EIP1193ErrorCode = {
  USER_REJECTED_REQUEST: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  UNRECOGNIZED_CHAIN_ID: 4902 // not in RFC but seems common (MetaMask ?)
} as const

export type EIP1193ErrorCode = (typeof EIP1193ErrorCode)[keyof typeof EIP1193ErrorCode]

export const EIP1193_ERROR_MESSAGES = {
  [EIP1193ErrorCode.USER_REJECTED_REQUEST]: 'User rejected the request.',
  [EIP1193ErrorCode.UNAUTHORIZED]: 'Unauthorized. Please connect your account.',
  [EIP1193ErrorCode.UNSUPPORTED_METHOD]: 'The requested method is not supported.',
  [EIP1193ErrorCode.DISCONNECTED]: 'Provider is disconnected from all chains.',
  [EIP1193ErrorCode.CHAIN_DISCONNECTED]: 'Provider is disconnected from the specified chain.',
  [EIP1193ErrorCode.UNRECOGNIZED_CHAIN_ID]: 'Unrecognized chain ID.'
} as const

//
// Zod Schemas for EIP-1193 Types
//

export const RequestArguments = z.object({
  method: z.string().describe('The RPC method name'),
  params: z
    .union([z.array(z.unknown()), z.record(z.unknown())])
    .optional()
    .describe('Method parameters')
})
export type RequestArguments = z.infer<typeof RequestArguments>

export const ProviderRpcError = z.object({
  code: z.number().describe('Standard EIP-1193 error code'),
  message: z.string().describe('Human-readable error message'),
  data: z.unknown().optional().describe('Additional error data')
})
export type ProviderRpcError = z.infer<typeof ProviderRpcError>

export const ProviderMessage = z.object({
  type: z.string().describe('Message type'),
  data: z.unknown().describe('Message data')
})
export type ProviderMessage = z.infer<typeof ProviderMessage>

export const ProviderConnectInfo = z.object({
  chainId: z.string().describe('Chain ID as hex string')
})
export type ProviderConnectInfo = z.infer<typeof ProviderConnectInfo>

//
// EIP-1193 Standard Events
//

export type EIP1193Events = {
  connect: [ProviderConnectInfo]
  disconnect: [ProviderRpcError]
  accountsChanged: [string[]]
  chainChanged: [string]
  message: [ProviderMessage]
}

//
// Method Parameter Schemas
//

export const WalletConnectParams = z.object({
  chainId: z.union([z.string(), z.number()]).optional().describe('Target chain ID (defaults to mainnet)')
})
export type WalletConnectParams = z.infer<typeof WalletConnectParams>

export const WalletSwitchEthereumChainParams = z.object({
  chainId: z.string().describe('Target chain ID as hex string (e.g., "0x1")')
})
export type WalletSwitchEthereumChainParams = z.infer<typeof WalletSwitchEthereumChainParams>

export const WalletAddEthereumChainParams = z.object({
  chainId: z.string().describe('Chain ID as hex string'),
  chainName: z.string().describe('Human-readable chain name'),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number()
  }),
  rpcUrls: z.array(z.string()).describe('RPC endpoint URLs'),
  blockExplorerUrls: z.array(z.string()).optional().describe('Block explorer URLs'),
  iconUrls: z.array(z.string()).optional().describe('Chain icon URLs')
})
export type WalletAddEthereumChainParams = z.infer<typeof WalletAddEthereumChainParams>

export const EthSendTransactionParams = z.object({
  from: z.string().describe('Sender address'),
  to: z.string().optional().describe('Recipient address (omit for contract creation)'),
  gas: z.string().optional().describe('Gas limit as hex string'),
  gasPrice: z.string().optional().describe('Gas price as hex string (legacy)'),
  maxFeePerGas: z.string().optional().describe('Maximum fee per gas (EIP-1559)'),
  maxPriorityFeePerGas: z.string().optional().describe('Maximum priority fee per gas (EIP-1559)'),
  value: z.string().optional().describe('Value to send as hex string'),
  data: z.string().optional().describe('Transaction data as hex string'),
  nonce: z.string().optional().describe('Transaction nonce as hex string')
})
export type EthSendTransactionParams = z.infer<typeof EthSendTransactionParams>

export const EthSignTypedDataParams = z.object({
  address: z.string().describe('Signing address'),
  typedData: z.union([z.string(), z.record(z.unknown())]).describe('EIP-712 typed data (JSON string or object)')
})
export type EthSignTypedDataParams = z.infer<typeof EthSignTypedDataParams>

export const PersonalSignParams = z.object({
  message: z.string().describe('Message to sign (hex string)'),
  address: z.string().describe('Signing address')
})
export type PersonalSignParams = z.infer<typeof PersonalSignParams>

//
// Connection State Types
//

export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting'
} as const

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState]

export const ConnectionInfo = z.object({
  state: z.nativeEnum(ConnectionState).describe('Current connection state'),
  chainId: z.string().describe('Current chain ID as hex string'),
  accounts: z.array(z.string()).describe('Connected account addresses'),
  connectedAt: z.number().optional().describe('Connection timestamp'),
  lastActivity: z.number().optional().describe('Last activity timestamp')
})
export type ConnectionInfo = z.infer<typeof ConnectionInfo>

//
// Utility Types
//

export type Hex = `0x${string}`
export type ChainId = number | Hex
export type Address = Hex
export type Hash = Hex

//
// Custom EIP-1193 Error Class
//

export class EIP1193Error extends Error implements ProviderRpcError {
  public readonly code: number
  public readonly data?: unknown

  constructor(code: EIP1193ErrorCode, message?: string, data?: unknown) {
    const errorMessage = message || EIP1193_ERROR_MESSAGES[code] || 'Unknown error'
    super(errorMessage)
    this.name = 'EIP1193Error'
    this.code = code
    this.data = data
  }

  static userRejected(message?: string, data?: unknown): EIP1193Error {
    return new EIP1193Error(EIP1193ErrorCode.USER_REJECTED_REQUEST, message, data)
  }

  static unauthorized(message?: string, data?: unknown): EIP1193Error {
    return new EIP1193Error(EIP1193ErrorCode.UNAUTHORIZED, message, data)
  }

  static unsupportedMethod(method: string, data?: unknown): EIP1193Error {
    return new EIP1193Error(EIP1193ErrorCode.UNSUPPORTED_METHOD, `Method "${method}" is not supported.`, data)
  }

  static unrecognizedChainId(chainId: string, data?: unknown): EIP1193Error {
    return new EIP1193Error(EIP1193ErrorCode.UNRECOGNIZED_CHAIN_ID, `Unrecognized chain ID "${chainId}".`, data)
  }

  static disconnected(message?: string, data?: unknown): EIP1193Error {
    return new EIP1193Error(EIP1193ErrorCode.DISCONNECTED, message, data)
  }
}

//
// Helper Functions
//

export const normalizeChainId = (chainId: ChainId): Hex => {
  if (typeof chainId === 'number') {
    return `0x${chainId.toString(16)}`
  }
  return chainId
}

export const parseChainId = (chainId: string | number): number => {
  if (typeof chainId === 'number') {
    return chainId
  }
  if (typeof chainId === 'string') {
    if (chainId.startsWith('0x')) {
      return parseInt(chainId, 16)
    }
    return parseInt(chainId, 10)
  }
  throw new Error(`Invalid chain ID: ${chainId}`)
}
