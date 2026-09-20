import { useAppContext } from 'lib/contexts/app';

import useIsMounted from './useIsMounted';

export function useSsrTime(): { isHydrating: boolean; now: number } {
  const { entityQuery, entityRenderedAt } = useAppContext();
  const isMounted = useIsMounted();
  const isHydrating = Boolean(entityQuery) && !isMounted;

  // Keep absolute and relative times identical until browser hydration completes.
  return { isHydrating, now: isHydrating && entityRenderedAt !== undefined ? entityRenderedAt : Date.now() };
}
