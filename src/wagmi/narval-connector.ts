/* eslint-disable no-console, @typescript-eslint/no-unused-vars */

import { createConnector, extractRpcUrls, type Connector } from '@wagmi/core'
import { SwitchChainError } from 'ox/Provider'
import { ClientChainNotConfiguredError, RpcError, UserRejectedRequestError, numberToHex, type Address } from 'viem'
import { getAddress } from 'viem/utils'
import { NarvalConnectWidget, type Narval1193Provider, type NarvalConnectWidgetConfig } from '../lib/widget.js'

const getConnectorConfig = ({
  name,
  icon,
  iconBackground
}: {
  name?: string | undefined
  icon?: string | undefined
  iconBackground?: string | undefined
} = {}) => ({
  id: `narval-${name || 'Institutional Wallets'}`,
  name: name || 'Institutional Wallets',
  type: 'injected' as const,
  icon:
    icon ||
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzUiIGhlaWdodD0iMzUiIHZpZXdCb3g9IjAgMCAzNSAzNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTcuNDg5IiBjeT0iMTcuNDg5IiByPSIxNy40ODkiIGZpbGw9ImJsYWNrIi8+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF80ODY1XzIpIj4KPHBhdGggZD0iTTEwLjUzNjQgMTQuNjA0NEg4LjkzMTY0VjEyLjk5OTdMMTcuNDkwMSA4LjE4NTU1TDI2LjA0ODYgMTIuOTk5N1YxNC42MDQ0SDI0LjQ0MzhIMTAuNTM2NFpNMjIuNzc1NiAxMi45OTk3TDE3LjQ5MDEgMTAuMDI3NkwxMi4yMDQ2IDEyLjk5OTdIMTYuNTY0QzE2LjQ3MzggMTIuODQyNiAxNi40MjAzIDEyLjY1ODcgMTYuNDIwMyAxMi40NjQ4QzE2LjQyMDMgMTEuODczIDE2Ljg5ODQgMTEuMzk1IDE3LjQ5MDEgMTEuMzk1QzE4LjA4MTggMTEuMzk1IDE4LjU1OTkgMTEuODczIDE4LjU1OTkgMTIuNDY0OEMxOC41NTk5IDEyLjY1ODcgMTguNTA2NCAxMi44NDI2IDE4LjQxNjEgMTIuOTk5N0gyMi43NzU2Wk0xMS4wNzEzIDE1LjY3NDJIMTIuNjc2VjIxLjAyMzJIMTQuODE1NlYxNS42NzQySDE2LjQyMDNWMjEuMDIzMkgxOC41NTk5VjE1LjY3NDJIMjAuMTY0NlYyMS4wMjMySDIyLjMwNDJWMTUuNjc0MkgyMy45MDQ5VjIxLjAyMzJIMjQuMTc2NEgyNC45Nzg3VjIyLjYyNzlIMjQuMTc2NEgxMC44MDM4SDEwLjAwMTRWMjEuMDIzMkgxMC44MDM4SDExLjA3MTNWMTUuNjc0MlpNOS43MzQgMjMuNjk3N0gyNS4yNDYySDI2LjA0ODZWMjUuMzAyNUgyNS4yNDYySDkuNzM0SDguOTMxNjRWMjMuNjk3N0g5LjczNFoiIGZpbGw9IndoaXRlIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfNDg2NV8yIj4KPHJlY3Qgd2lkdGg9IjE3LjExNjkiIGhlaWdodD0iMTcuMTE2OSIgZmlsbD0id2hpdGUiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDguOTMxNjQgOC4xODU1NSkiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K',
  iconBackground: iconBackground || '#000000',
  installed: true,
  extensionUrl: undefined,
  rdns: 'xyz.narval.armory'
})

export interface NarvalConnectOverrides {
  /**
   * Name for the connector instance
   */
  name?: string

  /**
   * Icon for the connector instance
   */
  icon?: string

  /**
   * Icon background for the connector instance
   */
  iconBackground?: string

  /**
   * Skip Provider selection, always use this provider for connections
   */
  provider?: string

  /**
   * If true, this connector will NOT be auto-connected if a connection deep-link is detected.
   */
  isSecondary?: boolean | undefined
}

type NarvalConfig = {
  config?: NarvalConnectWidgetConfig
  overrides?: NarvalConnectOverrides
}

const connectorInstances: NarvalConfig[] = []
const widgetInstances: Record<string, NarvalConnectWidget | undefined> = {}

const preventInvalidSetup = (config: NarvalConfig) => {
  if (!config.config) {
    throw new Error('Narval config is required')
  }

  connectorInstances.push(config)

  if (connectorInstances.length > 1) {
    // ensure only one is NOT marked as isSecondary
    const primaryInstance = connectorInstances.filter((instance) => !instance.overrides?.isSecondary)
    if (primaryInstance.length === 0 || primaryInstance.length > 1) {
      throw new Error('Narval wagmi connector can only have one primary instance')
    }
  }
}

export function narval(config: NarvalConfig) {
  let widget: NarvalConnectWidget | undefined = undefined
  // if we have duplicates of the SAME config, we can treat it as the same.
  const existingInstance = widgetInstances[JSON.stringify(config.config)]

  if (existingInstance) {
    widget = existingInstance
  } else {
    preventInvalidSetup(config)
    widget = config.config ? new NarvalConnectWidget(config.config) : undefined
    widgetInstances[JSON.stringify(config.config)] = widget
  }

  if (!widget) {
    console.error('❌ Narval widget not initialized')
    throw new Error('Invalid configuration, must provide `widget` or `config`')
  }

  const log = (...args: any[]): void => {
    if (widget.debug) {
      // eslint-disable-next-line no-console
      console.log(`[WAGMI - ${config?.overrides?.name || 'Narval'}]`, ...args)
    }
  }

  // Docs: https://wagmi.sh/dev/creating-connectors
  return createConnector<Narval1193Provider>((wagmiConfig) => {
    const connectorConfig = getConnectorConfig(config.overrides)
    log('🔧 Connector config:', {
      connectorConfig,
      wagmiConfig
    })
    const overrides = config.overrides || {}

    let accountsChanged: Connector['onAccountsChanged'] | undefined
    let chainChanged: Connector['onChainChanged'] | undefined
    let connect: Connector['onConnect'] | undefined
    let disconnect: Connector['onDisconnect'] | undefined

    const wagmiChains = wagmiConfig.chains ?? []
    // Extract RPC URLs from wagmi transports for readonly operations
    // We set this into the widget so we can fallback to it for things like `eth_estimateGas
    const readonlyRpcMap: Record<number, string> = {}
    for (const chain of wagmiChains) {
      const rpcUrls = extractRpcUrls({
        chain,
        transports: wagmiConfig.transports
      })
      if (rpcUrls && rpcUrls[0]) {
        readonlyRpcMap[chain.id] = rpcUrls[0]
      }
    }
    widget.setReadonlyRpcMap(readonlyRpcMap)

    return {
      id: connectorConfig.id,
      name: connectorConfig.name,
      type: connectorConfig.type,
      icon: connectorConfig.icon,
      iconBackground: connectorConfig.iconBackground,
      installed: connectorConfig.installed,

      // ✅ Mark connector as ready/available
      ready: true,
      supportsSimulation: false, // Narval handles simulation server-side
      supportsCapabilities: false, // Narval doesn't expose EIP-5792 capabilities yet

      // ✅ Additional properties to help ConnectKit recognize this as "installed"
      rdns: connectorConfig.rdns,

      async connect<withCapabilities extends boolean = false>({
        chainId,
        isReconnecting,
        withCapabilities,
        ...rest
      }: {
        chainId?: number | undefined
        isReconnecting?: boolean | undefined
        withCapabilities?: withCapabilities | boolean | undefined
      } = {}) {
        log('🔗 CONNECT METHOD CALLED!', { chainId, parameters: overrides })

        try {
          let accounts: readonly Address[] | undefined = []
          if (isReconnecting) {
            log('🔗 Reconnecting, getting accounts')
            accounts = await this.getAccounts().catch((e) => {
              log('🔴 Error getting accounts during reconnect:', e)
              return []
            })
          }
          const provider = (await this.getProvider()) as Narval1193Provider

          const targetChainId = chainId
          const optionalChains = wagmiChains
            .filter((chain) => chain.id !== targetChainId)
            .map((optionalChain) => optionalChain.id)
          const chains = targetChainId ? [targetChainId, ...optionalChains] : optionalChains // ensure targetChain is first.
          if (chains.length === 0) {
            log('🔴 No chains found on connector.')
            throw new Error('No chains found on connector.')
          }

          if (!isReconnecting) {
            const res = await provider.request({
              method: 'wallet_connect',
              params: [
                // Use a custom Narval value, so we're overloading eip-7846 without breaking it.
                {
                  _narval: {
                    chains: chains,
                    provider: overrides.provider
                  }
                }
              ]
            })
            accounts = res.map((x) => getAddress(x))
          }

          // Manage EIP-1193 event listeners
          // https://eips.ethereum.org/EIPS/eip-1193#events
          if (connect) {
            provider.removeListener?.('connect', connect)
            connect = undefined
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            provider.on?.('accountsChanged', accountsChanged as never)
          }
          if (!chainChanged) {
            chainChanged = this.onChainChanged.bind(this)
            provider.on?.('chainChanged', chainChanged)
          }
          if (!disconnect) {
            disconnect = this.onDisconnect.bind(this)
            provider.on?.('disconnect', disconnect)
          }

          // Switch to chain if provided
          let currentChainId = await this.getChainId()
          if (chainId && currentChainId !== chainId) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const chain = await this.switchChain!({ chainId }).catch((error) => {
              if (error.code === UserRejectedRequestError.code) throw error
              return { id: currentChainId }
            })
            currentChainId = chain?.id ?? currentChainId
          }

          // TypeScript can't narrow the conditional type, but at runtime we know
          // Narval doesn't support capabilities, so we always return simple addresses
          return { accounts, chainId: currentChainId } as {
            accounts: withCapabilities extends true
              ? readonly {
                  address: Address
                  capabilities: Record<string, unknown>
                }[]
              : readonly Address[]
            chainId: number
          }
        } catch (err) {
          const error = err as RpcError
          if (error.code === UserRejectedRequestError.code) throw new UserRejectedRequestError(error)
          throw error
        }
      },

      async disconnect() {
        log('🔴 disconnect called')
        const provider = (await this.getProvider()) as Narval1193Provider
        if (chainChanged) {
          provider.removeListener?.('chainChanged', chainChanged)
          chainChanged = undefined
        }
        if (disconnect) {
          provider.removeListener?.('disconnect', disconnect)
          disconnect = undefined
        }

        if (!connect) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          connect = this.onConnect!.bind(this)
          provider.on?.('connect', connect)
        }
        await provider.request({ method: 'wallet_disconnect' })

        wagmiConfig.emitter.emit('disconnect')
      },

      async getAccounts() {
        log('🔍 getAccounts called')

        const provider = (await this.getProvider()) as Narval1193Provider
        const accounts = await provider.request({ method: 'eth_accounts' })
        return accounts.map((a) => getAddress(a))
      },

      async getChainId() {
        log('🔍 getChainId called')
        try {
          const provider = (await this.getProvider()) as Narval1193Provider

          const hexChainId = await provider.request({ method: 'eth_chainId' })
          return Number(hexChainId)
        } catch (error) {
          // If we don't have a Provider yet, return 1 (mainnet)
          return 1
        }
      },

      async getProvider({ chainId }: { chainId?: number } = {}): Promise<Narval1193Provider> {
        log('🎯 getProvider called')

        // Create EIP-1193 provider
        if (!widget) {
          console.error('❌ Narval widget not initialized')

          throw new Error('Narval widget not initialized')
        }
        return widget.eip1193Provider
      },

      /**
       * Function that returns whether the connector has connected previously and is still authorized.
       */
      async isAuthorized() {
        // You MUST await this; if the widget has an existing session, this will ensure it's reconnected internally first.
        // If isAuthorized returns true, then it will call `connect` with `isReconnecting: true`
        const hasExistingSession = await widget.hasExistingSession()

        log('🔐 isAuthorized called', { hasExistingSession })

        // Always return false because the Widget will reconnect & broadcast it's connection if it exists.
        return hasExistingSession
      },

      /**
       * Optional function for running when the connector is first created.
       */
      async setup() {
        log('⚙️ Setup method called')

        // We set up the onConnect listener, because in a deep-link the Provider will emit the connect event.
        // We MUST only do it on one connector otherwise it will be handled by both.
        if (!connect && !overrides.isSecondary) {
          const provider = (await this.getProvider()) as Narval1193Provider
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          connect = this.onConnect!.bind(this)
          provider.on?.('connect', connect)
        }
        // Setup complete - Narval widget can be initialized dynamically
      },

      onAccountsChanged(accounts: string[]) {
        log('🔍 onAccountsChanged called', accounts)

        wagmiConfig.emitter.emit('change', {
          accounts: accounts.map((a) => getAddress(a))
        })
      },

      onChainChanged(newChainId: string | number) {
        log('🔍 onChainChanged called', newChainId)
        const id = Number(newChainId)
        wagmiConfig.emitter.emit('change', { chainId: id })
      },

      async onConnect(details) {
        log('🔗 onConnect called', details)
        const accounts = await this.getAccounts()
        if (accounts.length === 0) return

        const chainId = Number(details.chainId)

        wagmiConfig.emitter.emit('connect', { accounts, chainId })

        // Manage EIP-1193 event listeners
        const provider = (await this.getProvider()) as Narval1193Provider
        if (provider) {
          if (connect) {
            provider.removeListener?.('connect', connect)
            connect = undefined
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            provider.on?.('accountsChanged', accountsChanged as never)
          }
          if (!chainChanged) {
            chainChanged = this.onChainChanged.bind(this)
            provider.on?.('chainChanged', chainChanged)
          }
          if (!disconnect) {
            disconnect = this.onDisconnect.bind(this)
            provider.on?.('disconnect', disconnect)
          }
        }
      },

      async onDisconnect(error?: Error) {
        log('🔴 onDisconnect called', error)
        const provider = (await this.getProvider()) as Narval1193Provider
        wagmiConfig.emitter.emit('disconnect')

        // Manage EIP-1193 event listeners
        if (provider) {
          if (chainChanged) {
            provider.removeListener?.('chainChanged', chainChanged)
            chainChanged = undefined
          }
          if (disconnect) {
            provider.removeListener?.('disconnect', disconnect)
            disconnect = undefined
          }
          if (!connect) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            connect = this.onConnect!.bind(this)
            provider.on?.('connect', connect)
          }
        }
      },

      async switchChain({ chainId }) {
        log('🔄 switchChain called with chainId:', chainId)
        const chain = wagmiChains.find((x) => x.id === chainId)
        if (!chain) throw new SwitchChainError(new ClientChainNotConfiguredError())

        const provider = (await this.getProvider()) as Narval1193Provider
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: numberToHex(chainId) }]
          })
        } catch (error) {
          log('🔴 Error in switchChain', error)
          throw new SwitchChainError(error || new ClientChainNotConfiguredError())
        }

        return chain
      }
    }
  })
}
