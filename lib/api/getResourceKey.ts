import type { ResourceName, ResourcePathParams } from './resources';

export interface GetResourceKeyParams<R extends ResourceName> {
  pathParams?: ResourcePathParams<R>;
  queryParams?: Record<string, string | Array<string> | number | boolean | undefined | null>;
  chainId?: string;
}

export function getResourceKey<R extends ResourceName>(resource: R, { pathParams, queryParams, chainId }: GetResourceKeyParams<R> = {}) {
  if (pathParams || queryParams) {
    return [ resource, chainId, { ...pathParams, ...queryParams } ].filter(Boolean);
  }

  return [ resource, chainId ].filter(Boolean);
}
