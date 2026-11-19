import { createRpcRouteHandlers } from '../rpc-proxy-handler';

export const { POST, GET } = createRpcRouteHandlers({
  label: 'RPC',
  defaultLocalUrl: 'http://localhost:8545',
  localPortOffset: 4,
  envVars: ['RPC_ETHEREUM', 'ANVIL_RPC'],
});
