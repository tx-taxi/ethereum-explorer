import { useBreakpointValue } from '@chakra-ui/react';

import { useAppContext } from 'lib/contexts/app';

export default function useIsMobile(ssr?: boolean) {
  const { entityQuery } = useAppContext();
  // Match server and initial browser markup for hydrated entity pages.
  return useBreakpointValue({ base: true, lg: false }, { ssr: ssr ?? Boolean(entityQuery) });
}
