import React from 'react';

import urlParser from 'lib/token/metadata/urlParser';

export default function useLoadImageViaIpfs() {
  return React.useCallback(async(url: string) => {
    const gatewayUrl = urlParser(url);
    if (!gatewayUrl) {
      throw new Error('Invalid IPFS URL');
    }

    const response = await fetch(gatewayUrl);

    if (response.status !== 200) {
      throw new Error('Failed to load image');
    }

    const blob = await response.blob();
    const src = URL.createObjectURL(blob);
    return src;
  }, [ ]);
}
