import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { arcTestnet } from './chains';

export const config = getDefaultConfig({
  appName: 'Argus',
  projectId: 'argus-security-oracle',
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc-node.thecanteenapp.com'),
  },
});
