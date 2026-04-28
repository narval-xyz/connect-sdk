import { z } from 'zod'

// https://twitter.com/mattpocockuk/status/1622730173446557697?s=20&t=NdpAcmEFXY01xkqU3KO0Mg
export type Compute<type> = { [key in keyof type]: type[key] } & unknown

export const ConnectPermission = {
  CONNECTION_TRANSFER: 'connection:transfer',
  CONNECTION_STAKE: 'connection:stake',
  CONNECTION_RAW_SIGN: 'connection:raw_sign',
  CONNECTION_READ: 'connection:read', // Ability to read all data in the connection
  CONNECTION_CREATE: 'connection:create',
  CONNECTION_SYNC: 'connection:sync',
  CONNECTION_DELETE: 'connection:delete',
  CONNECTION_RAW_ACCOUNT_LIST: 'connection:raw_accounts',
  CONNECTION_PROXY: 'connection:proxy',
  CONNECTION_EVM: 'connection:evm',
  CONNECTION_DELEGATE: 'connection:delegate'
} as const
export type ConnectPermission = (typeof ConnectPermission)[keyof typeof ConnectPermission]

export const PermissionPolicies = z
  .object({
    policies: z.array(
      z.object({
        id: z.string().optional(),
        label: z.string().optional(),
        conditions: z.array(
          z.object({
            path: z.string(),
            value: z.any(),
            operator: z.string()
          })
        )
      })
    )
  })
  .describe('Custom policies for access control')
export type PermissionPolicies = z.infer<typeof PermissionPolicies>

export const ConnectGrantRequestAccess = z
  .object({
    type: z.literal('eip155').describe('Account/namespace type for EVM chains'),
    actions: z.array(z.string()).min(1).describe('JSON-RPC methods permitted for this access'),
    networks: z.array(z.string()).optional().describe('Network names/IDs for this access (e.g. "ETHEREUM")'),
    chains: z.array(z.number()).optional().describe('EVM chains by numeric chainId'),
    protocolPreset: z.array(z.string()).optional().describe('Protocol preset(s) for this access'),
    permissions: PermissionPolicies.optional()
  })
  .superRefine((data, ctx) => {
    const hasProtocolPreset = Array.isArray(data.protocolPreset) && data.protocolPreset.length > 0
    const hasPermissions = !!data.permissions?.policies && data.permissions.policies.length > 0
    if (!hasProtocolPreset && !hasPermissions) {
      ctx.addIssue({ code: 'custom', message: 'Must have either protocolPreset or permissions.policies' })
    }
  })
  .describe('V2 Access object in GrantRequest.accessToken.access')
export type ConnectGrantRequestAccess = z.infer<typeof ConnectGrantRequestAccess>

export const Account = z.object({
  type: z.string().optional().describe('The type of the account.'),
  chain: z.number().describe('The chain ID for EVM accounts (derived from network)'),
  address: z.string().describe('The address of the account.'),
  accountId: z.string().optional().describe('The Account ID for this access'),
  label: z.string().optional().describe('The label of the account.'),
  network: z.string().describe('Network ID in CAIP-2 format (e.g., eip155:1)')
})
export type Account = z.infer<typeof Account>
