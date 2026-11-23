import { createRpcRouteHandlers } from '../rpc-proxy-handler';

export const { POST, GET } = createRpcRouteHandlers({
  label: 'RPC2',
  defaultLocalUrl: 'http://localhost:8546',
  localPortOffset: 3,
  envVars: ['RPC_TRON', 'ANVIL_RPC2'],
});
