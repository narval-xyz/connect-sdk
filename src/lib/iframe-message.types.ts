import { z } from 'zod'
import { METHODS_REQUIRING_USER_INTERACTION } from '../shared/eip1193.types.js'
import { Account, ConnectGrantRequestAccess } from '../shared/shared.types.js'
import { Eip1193RpcRequest, transactionSubmitRequestSchema } from './types.js'

export const UiState = {
  /**
   * The window is a dialog that blocks interaction with its parent until
   * dismissed.
   */
  MODAL: 'modal',
  /**
   * The window is hidden from view but still exists in memory.
   */
  MINIMIZED: 'minimized',
  /**
   * The window is in mini-mode, displayed in one of the corners of the
   * screen, and it doesn't block interaction with its parent.
   */
  STATUS: 'status'
} as const
export type UiState = (typeof UiState)[keyof typeof UiState]

/**
 * Request types for parent-to-iframe communication.
 */
export const RequestType = {
  HANDSHAKE_REQUEST: 'v1.connection.handshake.request',
  HANDSHAKE_RESPONSE: 'v1.connection.handshake.response',

  ERROR_RESPONSE: 'v1.error.response',

  // Navigation
  NAVIGATE_TO_URL_REQUEST: 'v1.connection.navigate.to.url.request',

  // Session management
  END_SESSION_REQUEST: 'v1.session.end.request',
  RESTORE_SESSION_REQUEST: 'v1.session.restore.request',
  RESTORE_SESSION_RESPONSE: 'v1.session.restore.response',

  // Grant Flow
  START_GRANT_REQUEST: 'v1.grant.start.request',
  START_GRANT_RESPONSE: 'v1.grant.start.response',
  CONTINUE_GRANT_REQUEST: 'v1.grant.continue.request',
  CONTINUE_GRANT_RESPONSE: 'v1.grant.continue.response',

  // Transaction messages
  SEND_TRANSACTION_REQUEST: 'v1.send.transaction.request',
  SEND_TRANSACTION_REQUEST_RECEIVED: 'v1.send.transaction.request.received',

  EIP1193_RPC_REQUEST: 'v1.eip1193.rpc.request',
  EIP1193_RPC_RESPONSE: 'v1.eip1193.rpc.response',

  CLOSE_REQUEST: 'v1.widget.close.request',
  OPEN_REQUEST: 'v1.widget.open.request'
} as const
export type RequestType = (typeof RequestType)[keyof typeof RequestType]

/**
 * Event types for iframe-to-parent communication.
 */
export const EventType = {
  // Connection events emitted by the widget
  CONNECTION_EXIT: 'v1.connection.exit',

  UI_STATE_CHANGED: 'v1.widget.ui_state_changed.event',

  // EIP-1193 events emitted by the widget
  EIP1193_CONNECT: 'v1.eip1193.connect',
  EIP1193_DISCONNECT: 'v1.eip1193.disconnect',
  EIP1193_ACCOUNTS_CHANGED: 'v1.eip1193.accountsChanged',
  EIP1193_CHAIN_CHANGED: 'v1.eip1193.chainChanged'
} as const
export type EventType = (typeof EventType)[keyof typeof EventType]

export const MessageType = { ...RequestType, ...EventType } as const
export type MessageType = (typeof MessageType)[keyof typeof MessageType]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PostMessage<T = any, R = MessageType> = {
  type: R
  requestId?: string
  data?: T
}

export const ErrorResponseData = z.object({
  status: z.number().describe('The HTTP status code of the error'),
  message: z.string().describe('A human-readable error message'),
  errorCode: z.string().describe('A machine-readable error code'),
  details: z.string().describe('Additional details about the error').optional()
})
export type ErrorResponseData = z.infer<typeof ErrorResponseData>

/* NAVIGATE_TO_URL */
export const NavigateToUrlRequestData = z.object({
  url: z.string()
})
export type NavigateToUrlRequestData = z.infer<typeof NavigateToUrlRequestData>

/* END_SESSION */
export const EndSessionRequestData = z.null().or(z.undefined())
export type EndSessionRequestData = z.infer<typeof EndSessionRequestData>

/* RESTORE_SESSION */
export const RestoreSessionRequestData = z.object({})
export type RestoreSessionRequestData = z.infer<typeof RestoreSessionRequestData>
export const RestoreSessionResponseData = z.object({
  accounts: z.array(Account).nullable().optional()
})
export type RestoreSessionResponseData = z.infer<typeof RestoreSessionResponseData>

/* SEND_TRANSACTION */
export const SendTransactionRequestData = transactionSubmitRequestSchema
export type SendTransactionRequestData = z.infer<typeof SendTransactionRequestData>

export const SendTransactionRequestResponseData = z
  .object({
    transactionRequestId: z.string(),
    transactionHash: z.string().optional()
  })
  .or(z.void())
export type SendTransactionRequestResponseData = z.infer<typeof SendTransactionRequestResponseData>

/* EIP1193_RPC_REQUEST */
export const Eip1193RpcRequestData = Eip1193RpcRequest
export type Eip1193RpcRequestData = z.infer<typeof Eip1193RpcRequestData>

export const Eip1193RpcResponseData = z
  .object({
    result: z.any()
  })
  .or(
    z.object({
      error: z.object({
        code: z.number(),
        message: z.string(),
        data: z.any().optional()
      })
    })
  )
  .or(z.void())
export type Eip1193RpcResponseData = z.infer<typeof Eip1193RpcResponseData>

/* START_GRANT */
export const StartGrantRequestData = z.object({
  chains: z.array(z.number()).optional(),
  deepLinkToken: z.string().optional(),
  provider: z.string().optional(),
  access: z.array(ConnectGrantRequestAccess).optional()
})
export type StartGrantRequestData = z.infer<typeof StartGrantRequestData>
export const StartGrantResponseData = z.object({
  redirectUrl: z.string().optional(),
  accounts: z.array(Account).optional()
})
export type StartGrantResponseData = z.infer<typeof StartGrantResponseData>

/* CONTINUE_GRANT */
export const ContinueGrantRequestData = z.null().or(z.undefined())
export type ContinueGrantRequestData = z.infer<typeof ContinueGrantRequestData>
export const ContinueGrantResponseData = z.object({
  accounts: z.array(Account)
})
export type ContinueGrantResponseData = z.infer<typeof ContinueGrantResponseData>

export const EmptyRequestData = z.null().or(z.undefined())
export type EmptyRequestData = z.infer<typeof EmptyRequestData>

export const Eip1193ConnectEventData = z.object({
  chainId: z.string().describe('Hex-encoded chain ID (e.g., "0x1")')
})
export type Eip1193ConnectEventData = z.infer<typeof Eip1193ConnectEventData>

export const Eip1193DisconnectEventData = z.object({
  code: z.number().describe('EIP-1193 error code'),
  message: z.string().describe('Human-readable error message'),
  data: z.unknown().optional().describe('Additional error data')
})
export type Eip1193DisconnectEventData = z.infer<typeof Eip1193DisconnectEventData>

export const Eip1193AccountsChangedEventData = z.object({
  accounts: z.array(z.string()).describe('Array of account addresses')
})
export type Eip1193AccountsChangedEventData = z.infer<typeof Eip1193AccountsChangedEventData>

export const Eip1193ChainChangedEventData = z.object({
  chainId: z.string().describe('Hex-encoded chain ID (e.g., "0x1")')
})
export type Eip1193ChainChangedEventData = z.infer<typeof Eip1193ChainChangedEventData>

export const Eip1193MessageEventData = z.object({
  type: z.string().describe('Message type (e.g., "personal_sign_complete")'),
  data: z.unknown().describe('Message data')
})
export type Eip1193MessageEventData = z.infer<typeof Eip1193MessageEventData>

export const dataSchemaParsers: Partial<Record<MessageType, z.ZodType<any>>> = {
  [MessageType.ERROR_RESPONSE]: ErrorResponseData,
  [MessageType.RESTORE_SESSION_RESPONSE]: RestoreSessionResponseData,
  [MessageType.START_GRANT_RESPONSE]: StartGrantResponseData,
  [MessageType.CONTINUE_GRANT_RESPONSE]: ContinueGrantResponseData,
  [MessageType.EIP1193_RPC_RESPONSE]: Eip1193RpcResponseData
}

const eip1193ShouldShowDialog = (data: Eip1193RpcRequestData | null) => {
  if (!data?.method) return false
  return METHODS_REQUIRING_USER_INTERACTION.includes(data.method)
}

/* INCOMING MESSAGE MAP */
type MessageMapType = {
  isAsync?: boolean
  showDialog?: boolean | ((event: unknown) => boolean)
  request: {
    type: MessageType
    schema: z.ZodType | null
  }
  response: {
    type: MessageType
    schema: z.ZodType | null
  } | null
}

export const iframeRequestSchema: Record<string, MessageMapType | undefined> = {
  [RequestType.NAVIGATE_TO_URL_REQUEST]: {
    request: {
      type: RequestType.NAVIGATE_TO_URL_REQUEST,
      schema: NavigateToUrlRequestData
    },
    response: null,
    showDialog: true
  },
  [RequestType.END_SESSION_REQUEST]: {
    request: {
      type: RequestType.END_SESSION_REQUEST,
      schema: EndSessionRequestData
    },
    response: null
  },

  [RequestType.RESTORE_SESSION_REQUEST]: {
    request: {
      type: RequestType.RESTORE_SESSION_REQUEST,
      schema: RestoreSessionRequestData
    },
    response: {
      type: RequestType.RESTORE_SESSION_RESPONSE,
      schema: RestoreSessionResponseData
    }
  },
  [RequestType.SEND_TRANSACTION_REQUEST]: {
    isAsync: true,
    request: {
      type: RequestType.SEND_TRANSACTION_REQUEST,
      schema: SendTransactionRequestData
    },
    response: {
      type: RequestType.SEND_TRANSACTION_REQUEST_RECEIVED,
      schema: SendTransactionRequestResponseData
    },
    showDialog: true
  },

  [RequestType.START_GRANT_REQUEST]: {
    request: {
      type: RequestType.START_GRANT_REQUEST,
      schema: StartGrantRequestData
    },
    response: {
      type: RequestType.START_GRANT_RESPONSE,
      schema: StartGrantResponseData
    },
    showDialog: true
  },
  [RequestType.CONTINUE_GRANT_REQUEST]: {
    request: {
      type: RequestType.CONTINUE_GRANT_REQUEST,
      schema: ContinueGrantRequestData
    },
    response: {
      type: RequestType.CONTINUE_GRANT_RESPONSE,
      schema: ContinueGrantResponseData
    }
  },
  [RequestType.EIP1193_RPC_REQUEST]: {
    isAsync: true,
    request: {
      type: RequestType.EIP1193_RPC_REQUEST,
      schema: Eip1193RpcRequestData
    },
    response: {
      type: RequestType.EIP1193_RPC_RESPONSE,
      schema: Eip1193RpcResponseData
    },
    showDialog: eip1193ShouldShowDialog as (event: unknown) => boolean
  },
  [RequestType.OPEN_REQUEST]: {
    request: {
      type: RequestType.OPEN_REQUEST,
      schema: EmptyRequestData
    },
    response: null
  },
  [RequestType.CLOSE_REQUEST]: {
    request: {
      type: RequestType.CLOSE_REQUEST,
      schema: EmptyRequestData
    },
    response: null
  }
}
