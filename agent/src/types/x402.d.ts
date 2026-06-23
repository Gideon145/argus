// Type shim for @circle-fin/x402-batching/server (.mts)
declare module '@circle-fin/x402-batching/server' {
  import { RequestHandler } from 'express';

  export interface GatewayMiddleware {
    /** Create a paywall middleware for a specific amount (e.g. '$0.01') */
    require(amount: string): RequestHandler;
  }

  export interface GatewayMiddlewareOptions {
    sellerAddress: `0x${string}`;
    facilitatorUrl: string;
    networks: string[];
  }

  export function createGatewayMiddleware(options: GatewayMiddlewareOptions): GatewayMiddleware;
}
