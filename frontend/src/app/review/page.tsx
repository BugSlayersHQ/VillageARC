import FieldReviewDashboard from '@/components/FieldReviewDashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Field Review - VillageARC',
  description: 'Review and verify extracted land record fields against scanned images.',
};

export default function ReviewPage() {
  return <FieldReviewDashboard />;
}
