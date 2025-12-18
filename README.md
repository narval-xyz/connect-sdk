# Narval Connect SDK

A React SDK and Wagmi connector for connecting to institutional wallets.

## Installation

```bash
npm install @narval-xyz/connect
```

or

```bash
yarn add @narval-xyz/connect
```

or

```bash
pnpm add @narval-xyz/connect
```

## Peer Dependencies

This package requires the following peer dependencies:

- `react` >= 18.0.0
- `wagmi` >= 2.0.0
- `@wagmi/core` >= 2.0.0
- `@tanstack/react-query` >= 5.0.0
- `viem` >= 2.16.2

## Usage

### Wagmi Integration

```typescript
import { narval } from '@narval-xyz/connect/wagmi'
import { createConfig } from 'wagmi'

const narvalConnector = narval({
  config: {
    clientId: 'YOUR_CLIENT_ID',
    minimizedStyle: 'show'
  }
})

const wagmiConfig = createConfig({
  connectors: [narvalConnector]
})
```

### Configuration Options

- `clientId` (string, required): Your Narval client ID
- `minimizedStyle` (string): Control the minimized widget style ('show' | 'hide')
- `debug` show debug logging (default: false)
- `env` 'sandbox' | 'production' (default: production)
