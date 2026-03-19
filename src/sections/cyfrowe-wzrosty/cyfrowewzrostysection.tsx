import dynamic from 'next/dynamic';

const CyfroweWzrostyEngine = dynamic(
  () => import('./cyfrowewzrostyengine'),
  {
    loading: () => <section aria-hidden="true" style={{ minHeight: '100vh' }} />,
  }
);

export default function CyfroweWzrostySection() {
  return <CyfroweWzrostyEngine />;
}
