/* eslint-disable no-console, @typescript-eslint/no-unused-vars */

import { createConnector, extractRpcUrls, type Connector } from '@wagmi/core'
import { SwitchChainError } from 'ox/Provider'
import { ClientChainNotConfiguredError, RpcError, UserRejectedRequestError, numberToHex, type Address } from 'viem'
import { getAddress } from 'viem/utils'
import type { ConnectionDetails } from '../lib/iframe-message.types.js'
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
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU4IiBoZWlnaHQ9IjI1OCIgdmlld0JveD0iMCAwIDI1OCAyNTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xMyAzNi4yQzEzIDIzLjM4NyAyMy4zODcgMTMgMzYuMiAxM0g5OC4wNjY3QzExMC44OCAxMyAxMjEuMjY3IDIzLjM4NyAxMjEuMjY3IDM2LjJWOTguMDY2N0MxMjEuMjY3IDExMC44OCAxMTAuODggMTIxLjI2NyA5OC4wNjY3IDEyMS4yNjdIMzYuMkMyMy4zODcgMTIxLjI2NyAxMyAxMTAuODggMTMgOTguMDY2N1YzNi4yWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTEzNi43MzMgMTU5LjkzM0MxMzYuNzMzIDE0Ny4xMiAxNDcuMTIgMTM2LjczMyAxNTkuOTMzIDEzNi43MzNIMjIxLjhDMjM0LjYxMyAxMzYuNzMzIDI0NSAxNDcuMTIgMjQ1IDE1OS45MzNWMjIxLjhDMjQ1IDIzNC42MTMgMjM0LjYxMyAyNDUgMjIxLjggMjQ1SDE1OS45MzNDMTQ3LjEyIDI0NSAxMzYuNzMzIDIzNC42MTMgMTM2LjczMyAyMjEuOFYxNTkuOTMzWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTEzNi43MzMgMzYuMkMxMzYuNzMzIDIzLjM4NyAxNDcuMTIgMTMgMTU5LjkzMyAxM0gyMjEuOEMyMzQuNjEzIDEzIDI0NSAyMy4zODcgMjQ1IDM2LjJWOTguMDY2N0MyNDUgMTEwLjg4IDIzNC42MTMgMTIxLjI2NyAyMjEuOCAxMjEuMjY3SDE1OS45MzNDMTQ3LjEyIDEyMS4yNjcgMTM2LjczMyAxMTAuODggMTM2LjczMyA5OC4wNjY3VjM2LjJaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNMTMgMTU5LjkzM0MxMyAxNDcuMTIgMjMuMzg3IDEzNi43MzMgMzYuMiAxMzYuNzMzSDk4LjA2NjdDMTEwLjg4IDEzNi43MzMgMTIxLjI2NyAxNDcuMTIgMTIxLjI2NyAxNTkuOTMzVjIyMS44QzEyMS4yNjcgMjM0LjYxMyAxMTAuODggMjQ1IDk4LjA2NjcgMjQ1SDM2LjJDMjMuMzg3IDI0NSAxMyAyMzQuNjEzIDEzIDIyMS44VjE1OS45MzNaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNNjkuMTY0MyAxMDUuODAxQzY5LjE2NDMgMTA1LjgwMSAxMDIuMTI2IDkwLjIzOTggMTAyLjEyNiA3Mi4zNjQ0QzEwMi4xMjYgNTguNTAxMiAxMDIuMTI2IDQ5LjQ5NTggMTAyLjEyNiAzNS42MzI1QzgxLjIwMDggMjYuMDg4MiA1Ny4xMzA0IDI2LjA3ODMgMzYuMiAzNS42MTE3QzM2LjIxOSA0OS40ODE4IDM2LjIwMiA1OC40OTQzIDM2LjIwMiA3Mi4zNjQ0QzM2LjIwMiA5MC4yMzk4IDY5LjE2NDMgMTA1LjgwMSA2OS4xNjQzIDEwNS44MDFaIiBmaWxsPSIjMTY0N0RCIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNjMuNjUzMSA0My45MzMzSDY3LjkwNjNWNDguMTMyMUg3Mi4xNTk1VjQzLjkzMzNINzYuNDEyN1Y0OC40ODI5QzgxLjIzOTEgNDkuNTMzOSA4NC4xMzk0IDUyLjg4MjYgODQuMTM5NCA1Ny42NTgzQzg0LjEzOTQgNjEuMDE0NyA4Mi4xMTI0IDY0LjAyNTUgNzguNTc4MiA2NS4wNjIxQzgyLjU4MDIgNjYuMDk4NiA4NC45MTkgNjkuMzU2MyA4NC45MTkgNzIuOTU5NUM4NC45MTkgNzguMTE2MyA4MS44MTY3IDgxLjU4OTYgNzYuNDEyNyA4Mi43MjM4Vjg3LjMyNzJINzIuMTU5NVY4My4xMjc0SDY3LjkwNjNWODcuMzI3Mkg2My42NTMxVjgzLjEyNzRINTkuNFY0OC4xMzIxSDYzLjY1MzFWNDMuOTMzM1pNNzcuMzMwOSA1OC4wMDM4Qzc3LjMzMDkgNTUuMjM5NyA3NS4yNTE5IDUzLjYxMDkgNzEuNjY1NyA1My42MTA5SDY2LjA1MjZWNjIuMzk2N0g3Mi4wMjk2Qzc1LjM1NTkgNjIuMzk2NyA3Ny4zMzA5IDYwLjc2NzkgNzcuMzMwOSA1OC4wMDM4Wk03OC4xMTA1IDcyLjYxNEM3OC4xMTA1IDY5LjM1NjMgNzYuMDgzNSA2Ny43Mjc0IDcyLjA4MTYgNjcuNzI3NEg2Ni4wNTI2Vjc3LjQwMThINzEuNzE3N0M3NS42Njc3IDc3LjQwMTggNzguMTEwNSA3NS41NzU1IDc4LjExMDUgNzIuNjE0WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTIxNi43MDQgMTgxLjkzN0gyMTYuOTY1TDIyMy40OTcgMTYzLjUzMUwyMjQuNDg5IDE4Mi45MzlMMjI0LjczNyAxODIuOTk5QzIyNS4zMDcgMTgzLjEzOSAyMjUuODc3IDE4My4yODYgMjI2LjQ0NyAxODMuNDUzVjE4My41NzNDMjE3LjkyNCAxODQuMjQxIDIwOS42ODMgMTkyLjUxOSAyMDIuMzgxIDE5OS44MjhDMTk3LjkwOCAyMDQuMzExIDE5My42NjQgMjA4LjUxMyAxODkuNzg4IDIxMC43MzFDMTg0LjQ3IDIxMy43MTEgMTc5LjQ0OCAyMTUuMTYgMTc0LjQzMiAyMTUuMTZDMTY3LjMxMSAyMTUuMTYgMTYxLjc0NSAyMTMuMTAzIDE1Ny45MDMgMjA5LjE0OEMxNTEuOTQ4IDIwMi45NzUgMTUyLjE5NiAxOTQuMTIyIDE1Mi4yMDMgMTk0LjAwOUMxNTIuMjAzIDE5My43MjggMTUxLjQxOCAxNjUuODg5IDE3OS4yNTMgMTYzLjIxSDE3OS40ODFMMTc5LjY2OSAxNjIuNTQyQzE4Mi4wMjMgMTU4LjA0NiAxODYuOTkyIDE1NC4zMTEgMTkxLjA2OSAxNTIuMkMxOTAuOTg4IDE1My4zMjIgMTkwLjggMTU1Ljg3NCAxOTAuNTkyIDE1OC4yMTNDMTkwLjMzMSAxNjEuMDk5IDE4NC4zMjkgMTYzLjcxMSAxODQuMjIyIDE2My43NThMMTgyLjM5MSAxNjQuNzczTDE4My45NDcgMTY2LjIwM0MxODUuMTk0IDE2Ny4zNDYgMTg2Ljg5OCAxNjkuMTM2IDE4Ny4zIDE3MS40OTRDMTg3LjYyMiAxNzMuNDE4IDE4Ny4wOTIgMTc1LjU5IDE4Ni41MjkgMTc3LjQ1NEwxODYuMTk0IDE3OC41MjlDMTg1Ljc4NSAxNzkuODA1IDE4NS4zNjIgMTgxLjA2OCAxODQuOTMzIDE4Mi4zMzFDMTg0LjUwNCAxODMuNTkzIDE4NC4xMTUgMTg0Ljc2MyAxODMuNzE5IDE4NS45OTJDMTc5LjEwNiAxODEuMTQyIDE3OC43NDQgMTY4LjkyMiAxNzguNzE3IDE2Ni40NjRWMTY2LjExTDE3OC4zNDggMTY2LjE1NkMxNzguMjQ3IDE2Ni4xNTYgMTY4LjU1MSAxNjcuMzU5IDE2My4zMjEgMTc0LjEzM0MxNjAuNDc4IDE3Ny44MDEgMTU5LjQzOCAxODIuNDMxIDE2MC4yMyAxODcuODc2QzE2MS4wMjEgMTkzLjMyMSAxNjMuNTgyIDE5Ni43MDEgMTY3LjIzIDE5OC42ODVDMTcwLjA5MyAyMDAuMjIyIDE3Ni4xODkgMjAzLjU4OSAxODYuNTY5IDE5Ny4yMjJDMTg2Ljk3OCAxOTYuOTY4IDE5Mi41MTcgMTkyLjk2IDE5Mi44OTIgMTkyLjY2NkMxOTUuOTcgMTkwLjI0MSAyMDcuMzU2IDE4MS40NzYgMjE2LjcwNCAxODEuOTM3WiIgZmlsbD0iIzEyMTYyMSIvPgo8cGF0aCBkPSJNMTk0LjM5NCAyMTAuNTg5QzE4Ny41NDggMjE0Ljk4NSAxNzcuNDIzIDIxOS40NDggMTY3LjA2MiAyMTYuNjg4QzE2NC40MzEgMjE2LjAwMyAxNjEuOTM2IDIxNC44NzMgMTU5LjY4NiAyMTMuMzQ4QzE2OC40MDQgMjIzLjQ3NiAxNzguMjk0IDIyNi43OTYgMTg1LjMwOCAyMjcuNzY1QzE4OS45MzYgMjI4LjQxOSAxOTQuNjQ1IDIyOC4yNCAxOTkuMjA5IDIyNy4yMzhDMTk0LjYzNiAyMjEuMzY1IDE5NC4zNzQgMjEyLjk2MSAxOTQuMzk0IDIxMC41ODlaIiBmaWxsPSIjNjk2OTY5Ii8+CjxwYXRoIGQ9Ik0yMDQuOTA0IDIyOS41MzNDMjA2LjA1MSAyMjYuNjIxIDIxMy4wMzggMjA3Ljk2MSAyMDguMzY0IDE5Ny42MzJDMjAzIDIwMi40ODkgMTk3LjI4NyAyMDcuOTc0IDE5Ny4wMzIgMjA4LjkzNkMxOTcuMDEyIDIwOS4zMzcgMTk2LjM1NSAyMjMuNDk0IDIwNC45MDQgMjI5LjUzM1oiIGZpbGw9IiMxMjE2MjEiLz4KPHBhdGggZD0iTTIyNi45MjYgMTg2LjA1N0MyMjIuMzQ2IDE4NS4xNTUgMjExLjk5MyAxOTQuMjQ4IDIxMC41MTEgMTk1LjU3N0MyMTMuMTEzIDIwMS41OSAyMTIuNzg0IDIwOC42NDUgMjEyLjA0NyAyMTMuNTQ5QzIxMS42MDMgMjE2LjQzIDIxMC45MyAyMTkuMjcxIDIxMC4wMzUgMjIyLjA0N0MyMjguNjkgMjA5LjUzNCAyMjcuMTY4IDE4OC40NjkgMjI2LjkyNiAxODYuMDU3WiIgZmlsbD0iIzY5Njk2OSIvPgo8cGF0aCBkPSJNMjIxLjk4NCAyMjIuOTgxQzIyMy4zMjUgMjIwLjAwMSAyMjMuNDg2IDIxNC4wMDggMjIzLjQ4NiAyMTEuMTI5QzIyMS43NzYgMjE0LjY1IDIxOC41MjQgMjE4LjA1NyAyMTcuNzMyIDIxOC44NTlDMjE4LjU2IDIyMC43MyAyMjAuMDg1IDIyMi4yMDcgMjIxLjk4NCAyMjIuOTgxWiIgZmlsbD0iIzEyMTYyMSIvPgo8cGF0aCBkPSJNMzYuMiAxODMuMTMzVjE3Ny4zMzNMNjcuMTMzMyAxNTkuOTMzTDk4LjA2NjcgMTc3LjMzM1YxODMuMTMzSDM2LjJaTTg2LjIzNzEgMTc3LjMzM0w2Ny4xMzMzIDE2Ni41OTFMNDguMDI5NiAxNzcuMzMzSDYzLjc4NjJDNjMuNDYgMTc2Ljc2NSA2My4yNjY3IDE3Ni4xMDEgNjMuMjY2NyAxNzUuNEM2My4yNjY3IDE3My4yNjEgNjQuOTk0NiAxNzEuNTMzIDY3LjEzMzMgMTcxLjUzM0M2OS4yNzIxIDE3MS41MzMgNzEgMTczLjI2MSA3MSAxNzUuNEM3MSAxNzYuMTAxIDcwLjgwNjcgMTc2Ljc2NSA3MC40ODA0IDE3Ny4zMzNIODYuMjM3MVpNNDMuOTMzMyAxODdINDkuNzMzM1YyMDYuMzMzSDU3LjQ2NjdWMTg3SDYzLjI2NjdWMjA2LjMzM0g3MVYxODdINzYuOFYyMDYuMzMzSDg0LjUzMzNWMTg3SDkwLjMzMzNWMjA2LjMzM0g5NC4yVjIxMi4xMzNINDAuMDY2N1YyMDYuMzMzSDQzLjkzMzNWMTg3Wk05OC4wNjY3IDIxNlYyMjEuOEgzNi4yVjIxNkg5OC4wNjY3WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTE3Ny40MDEgNDQuODU4MUMxNzcuNDAxIDQ5LjYzOTkgMTczLjUyNSA1My41MTYzIDE2OC43NDMgNTMuNTE2M0MxNjMuOTYxIDUzLjUxNjMgMTYwLjA4NSA0OS42Mzk5IDE2MC4wODUgNDQuODU4MUMxNjAuMDg1IDQwLjA3NjQgMTYzLjk2MSAzNi4yIDE2OC43NDMgMzYuMkMxNzMuNTI1IDM2LjIgMTc3LjQwMSA0MC4wNzY0IDE3Ny40MDEgNDQuODU4MVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yMDAuNjY2IDQ0Ljg1ODFDMjAwLjY2NiA0OS42Mzk5IDE5Ni43OSA1My41MTYzIDE5Mi4wMDggNTMuNTE2M0MxODcuMjI3IDUzLjUxNjMgMTgzLjM1IDQ5LjYzOTkgMTgzLjM1IDQ0Ljg1ODFDMTgzLjM1IDQwLjA3NjQgMTg3LjIyNyAzNi4yIDE5Mi4wMDggMzYuMkMxOTYuNzkgMzYuMiAyMDAuNjY2IDQwLjA3NjQgMjAwLjY2NiA0NC44NTgxWiIgZmlsbD0iIzczNzM3MyIvPgo8cGF0aCBkPSJNMjIzLjkzMiA0NC44NTgxQzIyMy45MzIgNDkuNjM5OSAyMjAuMDU2IDUzLjUxNjMgMjE1LjI3NCA1My41MTYzQzIxMC40OTIgNTMuNTE2MyAyMDYuNjE2IDQ5LjYzOTkgMjA2LjYxNiA0NC44NTgxQzIwNi42MTYgNDAuMDc2NCAyMTAuNDkyIDM2LjIgMjE1LjI3NCAzNi4yQzIyMC4wNTYgMzYuMiAyMjMuOTMyIDQwLjA3NjQgMjIzLjkzMiA0NC44NTgxWiIgZmlsbD0iIzczNzM3MyIvPgo8cGF0aCBkPSJNMTc3LjQwMSA2Ny41NjQ1QzE3Ny40MDEgNzIuMzQ2MyAxNzMuNTI1IDc2LjIyMjYgMTY4Ljc0MyA3Ni4yMjI2QzE2My45NjEgNzYuMjIyNiAxNjAuMDg1IDcyLjM0NjMgMTYwLjA4NSA2Ny41NjQ1QzE2MC4wODUgNjIuNzgyNyAxNjMuOTYxIDU4LjkwNjMgMTY4Ljc0MyA1OC45MDYzQzE3My41MjUgNTguOTA2MyAxNzcuNDAxIDYyLjc4MjcgMTc3LjQwMSA2Ny41NjQ1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTIwMC42NjYgNjcuNTY0NUMyMDAuNjY2IDcyLjM0NjMgMTk2Ljc5IDc2LjIyMjYgMTkyLjAwOCA3Ni4yMjI2QzE4Ny4yMjcgNzYuMjIyNiAxODMuMzUgNzIuMzQ2MyAxODMuMzUgNjcuNTY0NUMxODMuMzUgNjIuNzgyNyAxODcuMjI3IDU4LjkwNjMgMTkyLjAwOCA1OC45MDYzQzE5Ni43OSA1OC45MDYzIDIwMC42NjYgNjIuNzgyNyAyMDAuNjY2IDY3LjU2NDVaIiBmaWxsPSIjNzM3MzczIi8+CjxwYXRoIGQ9Ik0yMjIuNjIxIDkwLjI2NDRDMjIyLjYyMSA5NS4wNDYyIDIxOC43NDQgOTguOTIyNiAyMTMuOTYzIDk4LjkyMjZDMjA5LjE4MSA5OC45MjI2IDIwNS4zMDUgOTUuMDQ2MiAyMDUuMzA1IDkwLjI2NDRDMjA1LjMwNSA4NS40ODI3IDIwOS4xODEgODEuNjA2MyAyMTMuOTYzIDgxLjYwNjNDMjE4Ljc0NCA4MS42MDYzIDIyMi42MjEgODUuNDgyNyAyMjIuNjIxIDkwLjI2NDRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjIyLjYyMSA2Ny41NjQ1QzIyMi42MjEgNzIuMzQ2MyAyMTguNzQ0IDc2LjIyMjYgMjEzLjk2MyA3Ni4yMjI2QzIwOS4xODEgNzYuMjIyNiAyMDUuMzA1IDcyLjM0NjMgMjA1LjMwNSA2Ny41NjQ1QzIwNS4zMDUgNjIuNzgyNyAyMDkuMTgxIDU4LjkwNjMgMjEzLjk2MyA1OC45MDYzQzIxOC43NDQgNTguOTA2MyAyMjIuNjIxIDYyLjc4MjcgMjIyLjYyMSA2Ny41NjQ1WiIgZmlsbD0iIzczNzM3MyIvPgo8cGF0aCBkPSJNMTc3LjQwMSA5MC4yNjQ0QzE3Ny40MDEgOTUuMDQ2MiAxNzMuNTI1IDk4LjkyMjYgMTY4Ljc0MyA5OC45MjI2QzE2My45NjEgOTguOTIyNiAxNjAuMDg1IDk1LjA0NjIgMTYwLjA4NSA5MC4yNjQ0QzE2MC4wODUgODUuNDgyNyAxNjMuOTYxIDgxLjYwNjMgMTY4Ljc0MyA4MS42MDYzQzE3My41MjUgODEuNjA2MyAxNzcuNDAxIDg1LjQ4MjcgMTc3LjQwMSA5MC4yNjQ0WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTIwMC42NjYgOTAuMjY0NEMyMDAuNjY2IDk1LjA0NjIgMTk2Ljc5IDk4LjkyMjYgMTkyLjAwOCA5OC45MjI2QzE4Ny4yMjcgOTguOTIyNiAxODMuMzUgOTUuMDQ2MiAxODMuMzUgOTAuMjY0NEMxODMuMzUgODUuNDgyNyAxODcuMjI3IDgxLjYwNjMgMTkyLjAwOCA4MS42MDYzQzE5Ni43OSA4MS42MDYzIDIwMC42NjYgODUuNDgyNyAyMDAuNjY2IDkwLjI2NDRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
  iconBackground: iconBackground,
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

/**
 * Resolve the widget instance to query for connection details.
 * Prefers the widget matching the provided config; otherwise falls back to the
 * primary (non-secondary) registered instance.
 */
const resolveWidgetForQuery = (config?: NarvalConnectWidgetConfig): NarvalConnectWidget | undefined => {
  if (config) {
    return widgetInstances[JSON.stringify(config)]
  }
  const primary = connectorInstances.find((i) => !i.overrides?.isSecondary) ?? connectorInstances[0]
  if (!primary?.config) {
    return undefined
  }
  return widgetInstances[JSON.stringify(primary.config)]
}

/**
 * Returns the details of the active widget connection — provider,
 * connectionId, and accounts. Returns `undefined` when there is no active
 * session yet (or when the widget has not been initialized).
 *
 * If multiple `narval()` connectors are registered, pass the same `config` used
 * to register the connector to disambiguate; otherwise the primary instance is
 * used.
 */
export async function getConnectionDetails(config?: NarvalConnectWidgetConfig): Promise<ConnectionDetails | undefined> {
  const widget = resolveWidgetForQuery(config)
  if (!widget) {
    return undefined
  }
  return widget.getConnectionDetails()
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
