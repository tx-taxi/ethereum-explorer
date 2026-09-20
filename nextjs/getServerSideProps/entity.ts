import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';

import config from 'configs/app';
import { getResourceKey } from 'lib/api/getResourceKey';

import { EntitySource } from './entitySource';
import type { EntityKind } from './entitySource';
import { notMultichain } from './guards';
import type { Props } from './handlers';
import { factory } from './utils';

const api = config.apis.general;
const source = new EntitySource(api ? `${ api.endpoint }${ api.basePath || '' }` : '');
const base = factory([ notMultichain ]);

function entity(kind: EntityKind): (context: GetServerSidePropsContext) => Promise<GetServerSidePropsResult<Props>> {
  return async(context) => {
    const baseline = await base(context);
    if (!('props' in baseline)) return baseline;
    const props = await baseline.props;
    const id = context.params?.[kind === 'block' ? 'height_or_hash' : 'hash'];
    const result = await source.get(kind, id);
    if (result.status === 200) {
      // Never share a query client across requests; only the bounded public API cache is shared.
      const client = new QueryClient();
      const key = kind === 'block' ?
        getResourceKey('general:block', { pathParams: { height_or_hash: String(id) } }) :
        getResourceKey('general:tx', { pathParams: { hash: String(id) } });
      client.setQueryData(key, result.data);
      const entityQuery = dehydrate(client);
      client.clear();
      return { props: { ...props, entityQuery } };
    }
    context.res.setHeader('X-Robots-Tag', 'noindex');
    context.res.setHeader('Cache-Control', 'no-store');
    if (result.status === 404) return { notFound: true };
    context.res.statusCode = 503;
    context.res.setHeader('Retry-After', '30');
    return { props: { ...props, entityUnavailable: true } };
  };
}

export const blockEntity = entity('block');
export const transactionEntity = entity('tx');
