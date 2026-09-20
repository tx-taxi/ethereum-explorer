import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Error from 'next/error';
import React from 'react';

import type { Props } from 'nextjs/getServerSideProps/handlers';
import PageNextJs from 'nextjs/PageNextJs';

const Transaction = dynamic(() => {
  return import('ui/pages/Transaction');
});

const Page: NextPage<Props> = (props: Props) => {
  if (props.entityUnavailable) return <Error statusCode={ 503 }/>;
  return (
    <PageNextJs pathname="/tx/[hash]" query={ props.query } serverRendered>
      <Transaction/>
    </PageNextJs>
  );
};

export default Page;

export { transactionEntity as getServerSideProps } from 'nextjs/getServerSideProps/entity';
