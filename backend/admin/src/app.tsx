import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { useMe } from '@/hooks/api/auth';
import { MainLayout } from '@/components/layout/main-layout';
import { AdList } from '@/routes/ads/ad-list';
import { SupportList } from '@/routes/support/support-list';
import { ApiKeyList } from '@/routes/api-keys/api-key-list';
import { Journal } from '@/routes/journal/journal';
import { VerificationList } from '@/routes/verifications/verification-list';
import { ConversationDetail } from '@/routes/conversations/conversation-detail';
import { DisputeList } from '@/routes/disputes/dispute-list';
import { Login } from '@/routes/login/login';
import { MemberDetail } from '@/routes/members/member-detail';
import { MemberList } from '@/routes/members/member-list';
import { MissionDetail } from '@/routes/missions/mission-detail';
import { MissionList } from '@/routes/missions/mission-list';
import { PayoutList } from '@/routes/payouts/payout-list';
import { PricingPage } from '@/routes/pricing/pricing-page';
import { RegionDetail } from '@/routes/regions/region-detail';
import { RegionList } from '@/routes/regions/region-list';

/** Signed in only (the session cookie is valid); otherwise the login page. */
const Protected = () => {
  const { isLoading, isError } = useMe();
  if (isLoading) return null;
  return isError ? <Navigate to="/login" replace /> : <Outlet />;
};

const router = createBrowserRouter(
  [
    { path: '/login', element: <Login /> },
    {
      element: <Protected />,
      children: [
        {
          element: <MainLayout />,
          children: [
            { index: true, element: <Navigate to="/missions" replace /> },
            { path: '/missions', element: <MissionList /> },
            { path: '/missions/:id', element: <MissionDetail /> },
            { path: '/members', element: <MemberList /> },
            { path: '/members/:id', element: <MemberDetail /> },
            { path: '/disputes', element: <DisputeList /> },
            { path: '/payouts', element: <PayoutList /> },
            { path: '/verifications', element: <VerificationList /> },
            { path: '/conversations/:id', element: <ConversationDetail /> },
            { path: '/pricing', element: <PricingPage /> },
            { path: '/ads', element: <AdList /> },
            { path: '/support', element: <SupportList /> },
            { path: '/settings/regions', element: <RegionList /> },
            { path: '/settings/regions/:id', element: <RegionDetail /> },
            { path: '/settings/api-keys', element: <ApiKeyList /> },
            { path: '/settings/journal', element: <Journal /> },
            { path: '*', element: <Navigate to="/missions" replace /> },
          ],
        },
      ],
    },
  ],
  { basename: '/admin' }
);

export const App = () => <RouterProvider router={router} />;
