import { z } from 'zod'

export const TransactionAction = {
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  PERSONAL_SIGN: 'personal_sign'
} as const
export type TransactionAction = (typeof TransactionAction)[keyof typeof TransactionAction]

export const hexSchema = z.custom<`0x${string}`>(
  (value) => {
    const parse = z.string().safeParse(value)

    if (parse.success) {
      if (!value) return false
      if (typeof value !== 'string') return false
      return /^0x[0-9a-fA-F]*$/.test(value)
    }

    return false
  },
  {
    message: 'value is an invalid hexadecimal'
  }
)

/**
 * EIP-712 typed data field validation
 */
export const typedDataFieldSchema = z.object({
  name: z.string().min(1, 'Field name cannot be empty'),
  type: z.string().min(1, 'Field type cannot be empty')
})

/**
 * EIP-712 domain validation
 */
export const eip712DomainSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  chainId: z.coerce.number().optional(),
  verifyingContract: hexSchema.optional(),
  salt: hexSchema.optional()
})

/**
 * EIP-712 typed data validation
 */
export const typedDataSchema = z.object({
  types: z.record(z.string(), z.array(typedDataFieldSchema)),
  primaryType: z.string().min(1, 'Primary type cannot be empty'),
  domain: eip712DomainSchema,
  message: z.record(z.any())
})

export const accessListSchema = z.array(
  z.object({
    address: hexSchema,
    storageKeys: z.array(hexSchema)
  })
)

// EVM Transaction Parameters
export const evmTransactionParamsSchema = z.object({
  chainId: hexSchema,
  from: hexSchema,
  to: hexSchema.optional(),
  value: hexSchema.optional(),
  data: hexSchema.optional(),

  // Gas settings (optional)
  nonce: z.number().optional(),
  gas: hexSchema.optional(),
  gasPrice: hexSchema.optional(),
  maxFeePerGas: hexSchema.optional(),
  maxPriorityFeePerGas: hexSchema.optional(),

  // Advanced features
  accessList: accessListSchema.optional(),
  maxFeePerBlobGas: hexSchema.optional(),
  blobVersionedHashes: z.array(hexSchema).optional(),
  type: hexSchema.optional()
})

// Personal Sign Parameters
export const personalSignParamsSchema = z.tuple([
  hexSchema.describe('Message to sign (hex-encoded UTF-8)'),
  hexSchema.describe('Address to sign with')
])

// Typed Data Parameters
export const typedDataParamsSchema = z.tuple([
  hexSchema.describe('Address to sign with'),
  typedDataSchema.describe('EIP-712 typed data')
])

export const ethSendTransactionRequestSchema = z.object({
  method: z.literal('eth_sendTransaction'),
  params: z.tuple([evmTransactionParamsSchema])
})

export const personalSignRequestSchema = z.object({
  method: z.literal('personal_sign'),
  params: personalSignParamsSchema
})

export const ethSignTypedDataV4RequestSchema = z.object({
  method: z.literal('eth_signTypedData_v4'),
  params: typedDataParamsSchema
})

// Transaction Request - Discriminated Union
export const transactionRequestSchema = z.discriminatedUnion('method', [
  ethSendTransactionRequestSchema,
  personalSignRequestSchema,
  ethSignTypedDataV4RequestSchema
])

// Main Transaction Submit Request
export const transactionSubmitRequestSchema = z.object({
  idempotenceId: z.string().optional(),
  request: transactionRequestSchema
})

export type EthSendTransactionRequest = z.infer<typeof ethSendTransactionRequestSchema>
export type TransactionSubmitRequest = z.infer<typeof transactionSubmitRequestSchema>

// TODO: type out ALL the rpc methods & union them here. See ox for typedefs.
export const Eip1193RpcRequest = z.object({
  id: z.number(),
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.any().optional()
})
export type Eip1193RpcRequest = z.infer<typeof Eip1193RpcRequest>
