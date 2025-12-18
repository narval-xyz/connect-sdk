import { Account, ConnectGrantRequestAccess } from '../shared/shared.types.js'

import { RpcResponse, RpcSchema, RpcTransport } from 'ox'
import { toNumber } from 'ox/Hex'
import * as Provider from 'ox/Provider'
import * as RpcRequest from 'ox/RpcRequest'
import { numberToHex } from 'viem'
import {
  EIP1193Error,
  EIP1193ErrorCode,
  READONLY_RPC_METHODS,
  type ReadonlyRpcMethod
} from '../shared/eip1193.types.js'
import { removeSearchParams } from '../shared/location.util.js'
import { hasSession, setHasSession } from './has-session.storage.js'
import {
  ContinueGrantRequestData,
  ContinueGrantResponseData,
  Eip1193AccountsChangedEventData,
  Eip1193ChainChangedEventData,
  Eip1193ConnectEventData,
  Eip1193DisconnectEventData,
  Eip1193RpcRequestData,
  Eip1193RpcResponseData,
  ErrorResponseData,
  EventType,
  MessageType,
  NavigateToUrlRequestData,
  RequestType,
  RestoreSessionRequestData,
  RestoreSessionResponseData,
  SendTransactionRequestData,
  SendTransactionRequestResponseData,
  StartGrantRequestData,
  StartGrantResponseData,
  UiState,
  dataSchemaParsers,
  iframeRequestSchema,
  type PostMessage
} from './iframe-message.types.js'
import { IframeWrapper } from './iframe.js'
import { WidgetError } from './widget.exception.js'
import type { IWindowWrapper } from './window-wrapper.interface.js'

const PRODUCTION_REDIRECT_BASE_URL = 'https://api.narval.xyz'
const PRODUCTION_WIDGET_BASE_URL = 'https://widget.narval.xyz'
const SANDBOX_REDIRECT_BASE_URL = 'https://api-staging.narval.xyz'

const DEFAULT_STATUS_MODE_POSITION = 'bottom_right'

type NarvalWalletConnectParam = {
  chains: number[]
  provider?: string | undefined
  access?: ConnectGrantRequestAccess[] | undefined
}

export type Narval1193Provider = Provider.Provider<{
  includeEvents: true
  schema:
    | RpcSchema.Eth
    | RpcSchema.From<{
        Request: {
          method: 'wallet_connect'
          params: {
            _narval?: NarvalWalletConnectParam
          }[]
        }
        ReturnType: string[]
      }>
}>

/**
 * The maximum number of attempts to send a handshake request to the parent
 * @type {Number}
 */
const MAX_HANDSHAKE_REQUESTS = 5

/**
 * The timeout for a handshake request
 * @type {Number}
 */
const HANDSHAKE_TIMEOUT = 10000 // 10 seconds

/**
 * The default timeout for an iframe request to post back
 * @type {Number}
 */
const DEFAULT_REQUEST_TIMEOUT = 300000 // 5 minutes

/**
 * Takes a URL and returns the origin
 * @param  {String} url The full URL being requested
 * @return {String}     The URLs origin
 */
const resolveOrigin = (url: string): string | null => {
  if (!url || url === '') return null
  try {
    const urlObj = new URL(url)

    // Only allow http/https protocols for security
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error(`Unsupported protocol: ${urlObj.protocol}`)
    }

    return urlObj.origin
  } catch (e) {
    // Invalid URL - throw error to prevent security issues
    throw new WidgetError({
      status: 400,
      errorCode: 'invalid_url',
      message: 'Invalid URL provided',
      details: `Failed to resolve origin for URL: ${url}`
    })
  }
}

export interface NarvalConnectWidgetConfig {
  clientId: string
  minimizedStyle?: 'show' | 'hide' | (string & NonNullable<unknown>)
  deepLinkToken?: string | null
  debug?: boolean
  env?: 'production' | 'sandbox' | 'development' | (string & NonNullable<unknown>)
  displayMode?: 'iframe' | 'popup'
  statusMode?: {
    position: 'top_left' | 'top_right' | 'bottom_right' | 'bottom_left'
  }
  development?: {
    widgetBaseUrl?: string
  }
  access?: ConnectGrantRequestAccess[] | null | undefined
  readonlyRpcMap?: Record<number, string> | undefined
}

export class NarvalConnectWidget {
  debug = false
  private windowWrapper: IWindowWrapper | null = null
  private handshakeCompleted = false
  private config: Required<NarvalConnectWidgetConfig>
  private verifiedOrigin: string | null = null
  private trustedWidgetWindow: Window | null = null
  private readonlyRpcMap: Record<number, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log('[WidgetParent]', ...args)
    }
  }

  constructorPromise: Promise<void> | null = null

  constructor(config: NarvalConnectWidgetConfig) {
    this.config = {
      env: 'production',
      development: {},
      minimizedStyle: 'show',
      debug: false,
      displayMode: 'iframe',
      access: null,
      deepLinkToken: null,
      statusMode: {
        position: DEFAULT_STATUS_MODE_POSITION
      },
      readonlyRpcMap: {},
      ...config
    }
    this.debug = this.config.debug
    this.readonlyRpcMap = this.config.readonlyRpcMap || {}

    // Security warning when debug mode is enabled
    if (this.config.debug && typeof window !== 'undefined' && typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        '%c⚠️ NARVAL CONNECT DEBUG MODE ENABLED ⚠️',
        'color: #ff6b6b; font-size: 16px; font-weight: bold; padding: 4px;'
      )
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.log('Not in a browser')
      return
    }

    this.handleMessage = this.handleMessage.bind(this)

    this.constructorPromise = this.asyncInstantiation()
  }

  private async asyncInstantiation(): Promise<void> {
    // Check for deep link token in the URL; if we have it, we'll run it.
    const result = await this.checkForDeepLinkToken()

    // Only restore a session if we don't have a deepLink to make a new connection.
    if (!result) {
      // Check for a persisted existing session; if we have it, we'll restore it.
      await this.checkForExistingSession()
    }
  }

  private async checkForDeepLinkToken(): Promise<void | { accounts: Account[] }> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.log('Not in a browser')
      return
    }

    const deepLinkToken = new URLSearchParams(window.location.search).get('deepLink')
    if (!deepLinkToken) {
      return
    }

    if (deepLinkToken) {
      // Remove the deep link token from the URL right away to minimize leakage.
      removeSearchParams('deepLink')
      const result = await this.deepLink({ deepLinkToken, access: this.config.access || undefined }).then((res) => {
        return res
      })
      return result
    }
  }

  public async hasExistingSession(): Promise<boolean> {
    await this.constructorPromise
    return hasSession(this.config.clientId)
  }

  private async checkForExistingSession(): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.log('Not in a browser')
      return
    }

    const existingSession = hasSession(this.config.clientId)
    if (existingSession) {
      this.log('Found existing session, initializing container')

      const widgetBaseUrl = this.getWidgetBaseUrl()
      const clientConnectUrl = `${widgetBaseUrl}`

      // Open the widget
      this.open(clientConnectUrl, UiState.MINIMIZED) // Open in minimized state

      // Wait for the widget to be ready and handshake to complete
      await this.waitForHandshake()

      this.log('Sending restore session request')
      const response = await this.sendRequest<RestoreSessionRequestData, RestoreSessionResponseData>({
        type: MessageType.RESTORE_SESSION_REQUEST,
        data: {}
      })
      this.log('Restore session response received', response)

      const provider = this.eip1193Provider
      if (response?.accounts && response.accounts.length > 0) {
        this.log('Found existing valid session, skipping grant flow')
        const chainId = await provider.request({ method: 'eth_chainId' })
        this.eip1193Emitter.emit('connect', { chainId })
      } else {
        // Ensure we are disconnected since we can't get any accounts.
        // This sends Widget the disconnect request, which clears internal state,
        // and then emits back to the parent (here) to clear the hasSession state.
        await provider.request({ method: 'wallet_disconnect' })
      }
    }
  }

  public getWidgetBaseUrl(): string {
    const override = this.config.development?.widgetBaseUrl
    if (this.config.env === 'development' && override) {
      return this.sanitizeWidgetBaseUrl(override)
    }

    if (override && this.config.env !== 'development') {
      this.log('Ignoring development.widgetBaseUrl override outside development env')
    }

    return PRODUCTION_WIDGET_BASE_URL
  }

  /**
   * Checks if the widget is mounted & ready to be used.
   * This means we have the widget container on the dom & the iframe is loaded & handshake complete.
   * @returns True if the widget is ready to be used
   */
  public isHandshakeCompleted(): boolean {
    return this.handshakeCompleted
  }

  private initializeContainer(): void {
    if (this.windowWrapper) {
      this.log('Already initialized')
      return
    }

    // Create the appropriate wrapper based on displayMode config
    if (this.config.displayMode === 'popup') {
      // this.windowWrapper = new PopupWrapper({
      //   debug: this.debug,
      //   onCloseRequest: this.handleCloseRequest.bind(this),
      //   statusMode: this.config.statusMode
      // })
      throw new Error('Popup mode is not implemented')
    } else {
      this.windowWrapper = new IframeWrapper({
        debug: this.debug,
        onCloseRequest: this.handleCloseRequest.bind(this),
        statusMode: this.config.statusMode,
        minimizedStyle: this.config.minimizedStyle
      })
    }

    window.addEventListener('message', this.handleMessage)
  }

  private open(url: string, uiState: UiState = UiState.MODAL): void {
    if (!this.windowWrapper) {
      this.log('Window Container not initialized, initializing now.')
      this.initializeContainer()
    }
    // initializeContainer() sets the value, so check again to make typescript happy.
    if (!this.windowWrapper) {
      this.log('Error: Window Container not initialized')
      return
    }

    const windowSrc = this.windowWrapper.getWindowSrc()

    // if the url is for the window's existing src & the origin is verified, soft-route.
    // Check the url's origin and the window.src origin
    if (url && resolveOrigin(url) === resolveOrigin(windowSrc || '') && this.verifiedOrigin === resolveOrigin(url)) {
      this.log('Soft-routing to existing URL', url)
      this.postMessage<NavigateToUrlRequestData, typeof MessageType.NAVIGATE_TO_URL_REQUEST>({
        type: MessageType.NAVIGATE_TO_URL_REQUEST,
        requestId: this.generateRequestId(),
        data: { url }
      })
    } else {
      this.verifiedOrigin = null
      this.trustedWidgetWindow = null
      // Add clientId as query param when hard-routing
      const urlWithParams = new URL(url)
      urlWithParams.searchParams.set('clientId', this.config.clientId)

      if (this.config.env === 'sandbox' || this.config.env === 'production') {
        urlWithParams.searchParams.set('env', this.config.env)
      }
      if (this.config.debug) {
        urlWithParams.searchParams.set('enableNarvalDebug', 'true')
      }
      // If we want to open the widget in a specific UI state, add it as a query param
      if (uiState) {
        urlWithParams.searchParams.set('initialUiState', uiState)
      }

      url = urlWithParams.toString()
      this.windowWrapper.open(url, uiState, this.sendHandshake.bind(this))
    }

    this.log('Opened with URL:', url)
  }

  public destroy(): void {
    this.handshakeCompleted = false
    if (this.windowWrapper) {
      this.windowWrapper.destroy()
      this.windowWrapper = null
      // Remove the event listener AFTER tick completes, otherwise it causes a race condition a bit.
      // Since this is called from within a `handleMessage` request, it's weird to change it's behavior while executing.
      setTimeout(() => {
        window.removeEventListener('message', this.handleMessage)
        this.trustedWidgetWindow = null // Clear it after the tick b/c the RPC request has to return to fully emit the disconnect event.
      }, 0)
    }
  }

  private handleCloseRequest(): void {
    // Send cancel pending requests message to iframe before minimizing.
    this.postMessage({
      type: RequestType.CLOSE_REQUEST,
      requestId: this.generateRequestId(),
      data: undefined
    })
  }

  /**
   * Begins the handshake strategy
   * @param  {String} url The URL to send a handshake request to
   * @return {Promise}     Promise that resolves when the handshake is complete
   */
  private sendHandshake(url: string): Promise<void> {
    const childOrigin = resolveOrigin(url)
    if (!childOrigin) {
      this.log('Error: Invalid URL for handshake', { url })
      return Promise.reject(
        new WidgetError({
          status: 500,
          errorCode: 'invalid_url',
          message: 'Invalid URL provided'
        })
      )
    }
    let attempt = 0
    let responseInterval: ReturnType<typeof setInterval>
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearInterval(responseInterval)
        window.removeEventListener('message', reply, false)
      }

      const reply = (e: MessageEvent<PostMessage>) => {
        if (e.data.type === MessageType.HANDSHAKE_REQUEST && e.origin === childOrigin) return
        if (!this.isWidgetMessageSource(e.source)) {
          this.log(`Ignoring message from non-allowed source: ${e.source}`, {
            verifiedOrigin: this.verifiedOrigin,
            data: e.data
          })
          return
        }
        if (e.data.type === MessageType.HANDSHAKE_RESPONSE && e.origin === childOrigin && !this.verifiedOrigin) {
          cleanup()
          this.log('Parent: Received handshake reply from Child')
          this.verifiedOrigin = e.origin
          this.trustedWidgetWindow = this.windowWrapper?.getContentWindow() ?? (e.source as Window | null)
          this.log('Parent: Saving Child origin', this.verifiedOrigin)
          // We completed the handshake, we're now "ready".
          this.handshakeCompleted = true
          return resolve()
        }
        // ignore other non-Narval messages
        return
      }

      window.addEventListener('message', reply, false)

      const doSend = () => {
        attempt++
        this.log(`Parent: Sending handshake attempt ${attempt}`, { childOrigin })
        this.postMessage<null | undefined, typeof MessageType.HANDSHAKE_REQUEST>(
          {
            type: MessageType.HANDSHAKE_REQUEST,
            requestId: this.generateRequestId()
          },
          childOrigin
        )

        if (attempt >= MAX_HANDSHAKE_REQUESTS) {
          cleanup()
          reject(
            new WidgetError({
              status: 500,
              errorCode: 'handshake_failed',
              message: 'Handshake failed: maximum attempts reached'
            })
          )
        }
      }

      doSend()
      responseInterval = setInterval(doSend, 500)

      this.log('Parent: Loading frame', { url })
    })
  }

  /**
   * Wait for the handshake to complete
   * @returns Promise that resolves when handshake is complete
   */
  private async waitForHandshake(): Promise<void> {
    if (this.verifiedOrigin) {
      return
    }

    this.log('Waiting for handshake')
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const checkInterval = setInterval(() => {
        if (this.verifiedOrigin) {
          clearInterval(checkInterval)
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          this.log('Handshake complete, continuing')
          resolve()
        }
      }, 100)

      // Timeout after 10 seconds
      timeoutId = setTimeout(() => {
        clearInterval(checkInterval)
        this.log('Handshake timed out')
        reject(
          new WidgetError({
            status: 500,
            errorCode: 'handshake_timed_out',
            message: 'Handshake timed out'
          })
        )
      }, HANDSHAKE_TIMEOUT)
    })
  }

  private postMessage<T, R extends MessageType>(message: PostMessage<T, R>, targetOrigin?: string): void {
    if (!this.windowWrapper) {
      this.log('Error: Cannot send message, window wrapper not available')

      return
    }

    const origin = targetOrigin || this.verifiedOrigin
    if (!origin) {
      this.log('Error: Cannot send message, null verified origin', { message })

      return
    }

    this.log(`Sending message to widget window: ${message.type}`, message)

    this.windowWrapper.postMessage(message, origin)
  }

  private async handleMessage(event: MessageEvent<PostMessage>): Promise<void> {
    if ((event as any).data?.target === 'metamask-inpage') return
    this.log(`Received message from origin ${event.origin}`, event)

    try {
      if (event.data?.type === MessageType.HANDSHAKE_RESPONSE || event.data?.type === MessageType.HANDSHAKE_REQUEST) {
        // Ignore the handshake response, it's handled by a separate listener.
        return
      }

      if (event.origin !== this.verifiedOrigin) {
        // this.log(`Ignoring message from non-allowed origin: ${event.origin}`, {
        //   verifiedOrigin: this.verifiedOrigin,
        //   data: event.data
        // })

        return
      }

      if (!this.isWidgetMessageSource(event.source)) {
        this.log(`Ignoring message from non-allowed source: ${event.source}`, {
          verifiedOrigin: this.verifiedOrigin,
          data: event.data
        })
        return
      }

      const message = event.data as PostMessage
      if (!message || typeof message !== 'object' || !message.type) {
        this.log(`Skip handler because message is invalid`, message)

        return
      }

      // Handle response from pending requests
      if (message?.requestId && this.pendingRequests.has(message.requestId)) {
        await this.handlePendingResponse(message)
        return
      }

      switch (message.type) {
        case EventType.CONNECTION_EXIT: {
          this.destroy()
          setHasSession(false, this.config.clientId)
          break
        }

        // EIP-1193 events from child widget - just forward to ox emitter
        case EventType.EIP1193_CONNECT: {
          const data = Eip1193ConnectEventData.parse(message.data)
          this.eip1193Emitter.emit('connect', { chainId: data.chainId as `0x${string}` })
          break
        }

        case EventType.EIP1193_DISCONNECT: {
          const data = Eip1193DisconnectEventData.parse(message.data)
          const error = new Provider.ProviderRpcError(data.code, data.message)
          this.eip1193Emitter.emit('disconnect', error)
          break
        }

        case EventType.EIP1193_ACCOUNTS_CHANGED: {
          const data = Eip1193AccountsChangedEventData.parse(message.data)
          this.eip1193Emitter.emit('accountsChanged', data.accounts as `0x${string}`[])
          break
        }

        case EventType.EIP1193_CHAIN_CHANGED: {
          const data = Eip1193ChainChangedEventData.parse(message.data)
          this.eip1193Emitter.emit('chainChanged', data.chainId as `0x${string}`)
          break
        }

        case EventType.UI_STATE_CHANGED:
          this.log(`Widget UI state changed to ${message.data.state}`)
          this.windowWrapper?.handleUIStateChange(message.data.state)
          break

        default:
          this.log(`Unhandled message type: ${message.type}`)
      }
    } catch (error) {
      this.log('Error handling message', { error, event })
      return
    }
  }

  // Map to track pending requests
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>()

  private async initConnect({
    chains,
    provider,
    access
  }: {
    chains?: number[] | undefined
    provider?: string | undefined
    access?: ConnectGrantRequestAccess[] | undefined
  }): Promise<{ accounts: Account[] }> {
    const widgetBaseUrl = this.getWidgetBaseUrl()
    const clientConnectUrl = `${widgetBaseUrl}/connect`

    // Open the widget
    this.open(clientConnectUrl)

    // Wait for the widget to be ready and handshake to complete
    await this.waitForHandshake()

    const accessRequest = access || this.config.access || undefined

    const { accounts } = await this.grantFlow({ chains, provider, access: accessRequest })
    const chainId = accounts[0]?.chain

    setHasSession(true, this.config.clientId)
    if (chainId) {
      this.eip1193Emitter.emit('connect', { chainId: numberToHex(chainId) })
    }
    return { accounts }
  }

  private async deepLink({
    deepLinkToken,
    access
  }: {
    deepLinkToken: string
    access?: ConnectGrantRequestAccess[] | undefined
  }): Promise<{ accounts: Account[] }> {
    this.log('Starting deep link')

    const widgetBaseUrl = this.getWidgetBaseUrl()
    const clientConnectUrl = `${widgetBaseUrl}/deep-link`

    // Open the widget
    this.open(clientConnectUrl)

    // Wait for the widget to be ready and handshake to complete
    await this.waitForHandshake()

    const { accounts } = await this.grantFlow({ deepLinkToken, access })

    setHasSession(true, this.config.clientId)

    // Get the chainId from the provider/widget so we aren't making it up here.
    const provider = this.eip1193Provider
    const chainId = await provider.request({ method: 'eth_chainId' })
    this.eip1193Emitter.emit('connect', { chainId })
    return { accounts }
  }

  private async grantFlow({
    chains,
    provider,
    access,
    deepLinkToken
  }: {
    deepLinkToken?: string | undefined
    chains?: number[] | undefined
    provider?: string | undefined
    access?: ConnectGrantRequestAccess[] | undefined
  }): Promise<{ accounts: Account[] }> {
    this.log('Starting grant flow')

    const { redirectUrl, accounts } = await this.startGrant({ chains, provider, access, deepLinkToken })

    if (redirectUrl && !this.isRedirectUrlAllowed(redirectUrl)) {
      this.log('Blocked redirect URL for environment', { redirectUrl, env: this.config.env })
      throw new WidgetError({
        status: 400,
        errorCode: 'invalid_redirect_url',
        message: 'Redirect URL is not allowed for the current environment.'
      })
    }

    if (redirectUrl) {
      const newWindow = window.open(redirectUrl || 'about:blank', '_blank')

      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        this.log('Popup was blocked by browser')
        throw new WidgetError({
          status: 500,
          errorCode: 'popup_blocked',
          message: 'Popup blocked. Please allow popups for this site.'
        })
      }
      // Prevent the popup from accessing the parent window
      newWindow.opener = null

      const { accounts } = await this.continueGrant()

      return { accounts }
    }

    if (accounts) {
      return { accounts }
    }

    this.log('No redirect URL or accounts received from grant flow')

    return { accounts: [] }
  }

  private async startGrant({
    chains,
    provider,
    access,
    deepLinkToken
  }: {
    deepLinkToken?: string | undefined
    chains?: number[] | undefined
    provider?: string | undefined
    access?: ConnectGrantRequestAccess[] | undefined
  }): Promise<StartGrantResponseData> {
    this.log('Sending start grant request', this.pendingRequests)

    return this.sendRequest<StartGrantRequestData, StartGrantResponseData>({
      type: MessageType.START_GRANT_REQUEST,
      data: { deepLinkToken, chains, provider, access }
    })
  }

  private isRedirectUrlAllowed(redirectUrl?: string | null): boolean {
    if (!redirectUrl) {
      return false
    }

    if (this.config.env === 'development') {
      return true
    }

    const allowedBase = this.config.env === 'sandbox' ? SANDBOX_REDIRECT_BASE_URL : PRODUCTION_REDIRECT_BASE_URL

    try {
      const origin = resolveOrigin(redirectUrl)
      return origin === allowedBase
    } catch (error) {
      this.log('Failed to validate redirect URL', { redirectUrl, error })
      return false
    }
  }

  private async continueGrant(): Promise<ContinueGrantResponseData> {
    return this.sendRequest<ContinueGrantRequestData, ContinueGrantResponseData>({
      type: MessageType.CONTINUE_GRANT_REQUEST,
      data: undefined
    })
  }

  /**
   * Send a transaction to the iframe
   * @param transaction - The transaction to send
   * @returns Promise that resolves with the transactionId
   */
  public async sendTransaction(transaction: SendTransactionRequestData): Promise<SendTransactionRequestResponseData> {
    return this.sendRequest<SendTransactionRequestData, SendTransactionRequestResponseData>({
      type: MessageType.SEND_TRANSACTION_REQUEST,
      data: transaction
    })
  }

  private async sendRequest<T, Q>({
    type,
    data,
    timeout = DEFAULT_REQUEST_TIMEOUT
  }: {
    type: MessageType
    data: T
    timeout?: number | null
  }): Promise<Q> {
    await this.waitForHandshake()

    const requestId = this.generateRequestId()
    const reqSchema = iframeRequestSchema[type]
    if (!reqSchema) {
      throw new WidgetError({
        status: 500,
        errorCode: 'invalid_data',
        message: 'Invalid data in request',
        details: `[${type}]: ${requestId}`
      })
    }

    return new Promise((resolve, reject) => {
      let parsedData: unknown = undefined
      try {
        parsedData = data !== undefined ? reqSchema?.request.schema?.parse(data) : undefined
      } catch (error) {
        this.log('Error parsing data', { type, data, error })
        return reject(
          new WidgetError({
            status: 500,
            errorCode: 'invalid_data',
            message: 'Invalid data in request',
            details: `[${type}]: ${requestId}`
          })
        )
      }
      // Store the promise handlers
      this.pendingRequests.set(requestId, { resolve, reject })

      // Send the request
      this.postMessage({
        type: reqSchema?.request.type,
        requestId,
        data: parsedData
      })

      if (timeout !== null) {
        // Set a timeout
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            reject(
              new WidgetError({
                status: 500,
                errorCode: 'request_timeout',
                message: 'Request timed out waiting for response',
                details: `[${type}]: ${requestId}`
              })
            )
          }
        }, timeout || DEFAULT_REQUEST_TIMEOUT)
      }
    })
  }

  // Handle the response to a pending request; the pending request should be initiated with `sendRequest`
  private async handlePendingResponse(message: PostMessage): Promise<void> {
    if (!message?.requestId || !this.pendingRequests.has(message.requestId)) {
      this.log('Error: No requestId or pendingRequests.has(requestId) is false', { message })
      return
    }

    const dataSchema = dataSchemaParsers[message.type]
    if (!dataSchema) {
      this.log(`Unknown message type: ${message.type}`, { message })
      return
    }

    const { resolve, reject } = this.pendingRequests.get(message.requestId) || {}
    if (!resolve || !reject) {
      this.log('Error: No resolve or reject function found for requestId', { message })
      return
    }
    // Remove the pending request so we don't try to handle it again.
    this.pendingRequests.delete(message.requestId)

    if (message.type === MessageType.ERROR_RESPONSE) {
      this.log('Error response received', { message })
      return reject(new WidgetError(message.data as ErrorResponseData))
    }

    try {
      const parsedData = dataSchema.parse(message.data)
      return resolve(parsedData)
    } catch (error) {
      this.log('Error parsing data', { error, message })
      return reject(
        new WidgetError({
          status: 500,
          errorCode: 'invalid_data',
          message: 'Invalid data in response',
          details: `[${message.type}]: ${message.requestId}`
        })
      )
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  private getWidgetWindow(): Window | null {
    return this.windowWrapper?.getContentWindow() ?? this.trustedWidgetWindow
  }

  private isWidgetMessageSource(source: MessageEvent['source']): source is Window {
    const widgetWindow = this.getWidgetWindow()
    if (!widgetWindow) {
      this.log('Ignoring message because widget window reference is unavailable', { source })
      return false
    }
    if (source !== widgetWindow) {
      this.log('Ignoring message from unexpected window source', { source })
      return false
    }
    return true
  }

  private sanitizeWidgetBaseUrl(url: string): string {
    try {
      const candidate = new URL(url)
      const hostname = candidate.hostname.toLowerCase()
      const isLocalOverride = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
      if (candidate.protocol !== 'https:' && !(isLocalOverride && candidate.protocol === 'http:')) {
        throw new Error('Widget base URL must use https or http://localhost for development.')
      }
      const normalizedPath = candidate.pathname.replace(/\/+$/, '')
      return `${candidate.origin}${normalizedPath === '/' ? '' : normalizedPath}`
    } catch (error) {
      throw new WidgetError({
        status: 400,
        errorCode: 'invalid_widget_base_url',
        message: 'Invalid development.widgetBaseUrl. Use https://... or http://localhost.',
        details: error instanceof Error ? error.message : undefined
      })
    }
  }

  private requestStore = RpcRequest.createStore()

  // Instantiate a Provider Emitter.
  private eip1193Emitter = Provider.createEmitter()
  private getEip1193Provider(): Narval1193Provider {
    return Provider.from({
      ...this.eip1193Emitter,
      request: async (r) => {
        const request = this.requestStore.prepare(r as any)
        const rpcMethod = request.method as string

        // Check if this is a readonly RPC method that we can handle directly
        if (Object.values(READONLY_RPC_METHODS).includes(rpcMethod as ReadonlyRpcMethod)) {
          // TODO: get chainId without having to fetch it from the widget every time.
          const chainId = await this.getEip1193Provider().request({ method: 'eth_chainId' })
          return await this.makeReadonlyRpcCall(toNumber(chainId), rpcMethod, request.params as unknown[])
        }

        // NOTE: For provider discovery, dApps should use EIP-6963 (Multi Injected Provider Discovery)
        // instead of custom methods. EIP-6963 uses window events to announce and discover providers.
        // See: https://eips.ethereum.org/EIPS/eip-6963

        // wallet_connect is special - handle it entirely in the parent
        if (rpcMethod === 'wallet_connect') {
          try {
            const params = request.params as { _narval?: NarvalWalletConnectParam }[] | undefined
            const narvalParams = params?.find((p) => !!p._narval)
            await this.initConnect({
              chains: narvalParams?._narval?.chains,
              provider: narvalParams?._narval?.provider,
              access: narvalParams?._narval?.access
            })
            // Don't return; this will fall-through to the RPC Request Handler, which will call wallet_connect in widget & return the connected accounts.
          } catch (error) {
            if (error instanceof WidgetError) {
              throw new EIP1193Error(
                error.status as EIP1193ErrorCode,
                error.message,
                error.details ? { details: error.details } : undefined
              )
            }
            throw error
          }
        }

        // All methods require widget to be ready (EIP-1193 compliance)
        if (!this.isHandshakeCompleted()) {
          throw EIP1193Error.disconnected(
            'Provider is disconnected from all chains. Widget must be initialized before calling this method.'
          )
        }

        const response = await this.sendRequest<Eip1193RpcRequestData, Eip1193RpcResponseData>({
          type: MessageType.EIP1193_RPC_REQUEST,
          data: request,
          timeout: null // Don't timeout rpc requests.
        }).catch((error) => {
          // Convert WidgetError to proper EIP-1193 error format
          if (error instanceof WidgetError) {
            // Use the status as the error code if it's an EIP-1193 code
            const isEip1193Code = Object.values(EIP1193ErrorCode).includes(error.status as EIP1193ErrorCode)
            if (isEip1193Code) {
              throw new EIP1193Error(
                error.status as EIP1193ErrorCode,
                error.message,
                error.details ? { details: error.details } : undefined
              )
            } else {
              // Non-EIP-1193 errors get thrown as generic errors
              throw new Error(error.message)
            }
          }
          throw error
        })

        const rpcResponse = RpcResponse.parse(response)
        return rpcResponse
      }
    }) as Narval1193Provider
  }

  /**
   * Make a direct RPC call to a readonly RPC
   * This is for when the Narval provider doesn't support a rpc method (i.e. eth_estimateGas)
   */
  private async makeReadonlyRpcCall(chainId: number, method: string, params?: unknown[]): Promise<unknown> {
    const rpcUrl = this.readonlyRpcMap[chainId]
    if (!rpcUrl) {
      throw new Error(`No readonly RPC URL configured for chain ID ${chainId}`)
    }

    this.log(`Making direct RPC call to ${rpcUrl} for method ${method}:`, params)

    try {
      // Create an ox RPC transport from the HTTP endpoint
      const transport = RpcTransport.fromHttp(rpcUrl)

      // Create an EIP-1193 provider from the transport
      const provider = Provider.from(transport)

      // Make the RPC request using ox provider
      const result = await provider.request({
        method: method,
        params: params || []
      })

      return result
    } catch (error) {
      this.log('Direct RPC call failed:', error)

      // Handle ox provider errors and convert to EIP-1193 errors
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        const rpcError = error as { code?: number; message?: string; data?: unknown }

        // Validate that the error code is a valid EIP-1193 error code
        const validCodes = Object.values(EIP1193ErrorCode)
        const errorCode =
          rpcError.code && validCodes.includes(rpcError.code as EIP1193ErrorCode)
            ? (rpcError.code as EIP1193ErrorCode)
            : EIP1193ErrorCode.UNSUPPORTED_METHOD

        throw new EIP1193Error(errorCode, rpcError.message || 'RPC request failed', rpcError.data)
      }

      throw new EIP1193Error(
        EIP1193ErrorCode.UNSUPPORTED_METHOD,
        `Direct RPC call failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  public setReadonlyRpcMap(readonlyRpcMap: Record<number, string>): void {
    this.readonlyRpcMap = readonlyRpcMap
  }

  public eip1193Provider: Narval1193Provider = this.getEip1193Provider()
}
