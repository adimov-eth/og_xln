import type { RequestHandler } from '@sveltejs/kit';
import { fetchRpcProxyText, isLocalProxyRequest, readRpcProxyRequest, RpcProxyError } from './rpc-proxy-safety';

const DEFAULT_RPC_PROXY_TIMEOUT_MS = 5_000;

const readRpcProxyTimeoutMs = (): number => {
  const value = Number(process.env['XLN_RPC_PROXY_TIMEOUT_MS'] || '');
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_RPC_PROXY_TIMEOUT_MS;
};

export const createRpcProxyHandler =
  (getRpcUrl: (requestUrl: string, clientAddress?: string) => string, label: string): RequestHandler =>
  async ({ request, getClientAddress }) => {
    try {
      const { bodyText, forbiddenMethod } = await readRpcProxyRequest(request);
      if (forbiddenMethod) {
        return new Response(
          JSON.stringify({ error: `${label} proxy method is not allowed`, method: forbiddenMethod }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const { response: upstream, text: data } = await fetchRpcProxyText(
        getRpcUrl(request.url, getClientAddress()),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText,
        },
        readRpcProxyTimeoutMs(),
      );
      return new Response(data, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: `${label} request failed`,
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: error instanceof RpcProxyError ? error.status : 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };

type RpcRouteConfig = {
  label: string;
  defaultLocalUrl: string;
  localPortOffset: number;
  envVars: readonly [string, string];
};

export const createRpcRouteHandlers = (config: RpcRouteConfig): { POST: RequestHandler; GET: RequestHandler } => {
  const { label, defaultLocalUrl, localPortOffset, envVars } = config;
  const resolveLocalUrl = (requestUrl: string): string => {
    const { hostname, port } = new URL(requestUrl);
    if (hostname !== 'localhost') return defaultLocalUrl;
    const currentPort = Number(port || 0);
    if (!Number.isFinite(currentPort) || currentPort < 1) return defaultLocalUrl;
    if (currentPort === 8080) return defaultLocalUrl;
    const shiftedPort = currentPort - localPortOffset;
    return shiftedPort < 1 ? defaultLocalUrl : `http://localhost:${shiftedPort}`;
  };
  const getRpcUrl = (requestUrl: string, clientAddress?: string): string => {
    if (isLocalProxyRequest(requestUrl, clientAddress)) return resolveLocalUrl(requestUrl);
    const rpcUrl = process.env[envVars[0]] ?? process.env[envVars[1]];
    if (!rpcUrl) {
      throw new Error(`${label}_PROXY_MISCONFIGURED: set ${envVars[0]} or ${envVars[1]} for non-local host`);
    }
    return rpcUrl;
  };
  return {
    POST: createRpcProxyHandler(getRpcUrl, label),
    GET: async () =>
      new Response(JSON.stringify({ error: `${label} proxy requires POST requests` }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }),
  };
};
