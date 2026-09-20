import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Error from 'next/error';
import React from 'react';

import type { Props } from 'nextjs/getServerSideProps/handlers';
import PageNextJs from 'nextjs/PageNextJs';

const Block = dynamic(() => import('ui/pages/Block'), { ssr: false });

const Page: NextPage<Props> = (props: Props) => {
  if (props.entityUnavailable) return <Error statusCode={ 503 }/>;
  return (
    <PageNextJs pathname="/block/[height_or_hash]" query={ props.query }>
      <Block/>
    </PageNextJs>
  );
};

export default Page;

export { blockEntity as getServerSideProps } from 'nextjs/getServerSideProps/entity';
