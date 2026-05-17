import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import PrivateRoute from './components/auth/PrivateRoute';

// Loading Spinner
const Spinner = () => (
  <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
    <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
  </div>
);

// Lazy Loaded Pages
const LoginPage = lazy(() => import('./pages/Login/LoginPage').then(m => ({ default: m.LoginPage })));
const PlayerHomePage = lazy(() => import('./pages/PlayerHome/PlayerHomePage').then(m => ({ default: m.PlayerHomePage })));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CreateCharacterPage = lazy(() => import('./pages/Character/CreateCharacterPage').then(m => ({ default: m.CreateCharacterPage })));
const CharacterSheet = lazy(() => import('./pages/Character/CharacterSheet'));
const GMDashboardPage = lazy(() => import('./pages/GM/GMDashboardPage').then(m => ({ default: m.GMDashboardPage })));
const GMCampaignListPage = lazy(() => import('./pages/GM/Campaigns/GMCampaignListPage').then(m => ({ default: m.GMCampaignListPage })));
const CreateCampaignPage = lazy(() => import('./pages/GM/Campaigns/CreateCampaignPage').then(m => ({ default: m.CreateCampaignPage })));
const CampaignViewPage = lazy(() => import('./pages/Campaign/CampaignViewPage').then(m => ({ default: m.CampaignViewPage })));
const PlayerCampaignListPage = lazy(() => import('./pages/PlayerHome/PlayerCampaignListPage').then(m => ({ default: m.PlayerCampaignListPage })));
const ManageIDsPage = lazy(() => import('./pages/GM/ManageIDsPage').then(m => ({ default: m.ManageIDsPage })));
const ManageSystemsPage = lazy(() => import('./pages/GM/ManageSystemsPage').then(m => ({ default: m.ManageSystemsPage })));
const ShadowdarkMenuPage = lazy(() => import('./pages/GM/Systems/ShadowdarkMenuPage').then(m => ({ default: m.ShadowdarkMenuPage })));
const ShadowdarkSpellsPage = lazy(() => import('./pages/GM/Systems/ShadowdarkSpellsPage').then(m => ({ default: m.ShadowdarkSpellsPage })));
const ShadowdarkItemsPage = lazy(() => import('./pages/GM/Systems/ShadowdarkItemsPage').then(m => ({ default: m.ShadowdarkItemsPage })));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<Spinner />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Spinner />}>
            <PlayerHomePage />
          </Suspense>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<Spinner />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'character/create',
        element: (
          <Suspense fallback={<Spinner />}>
            <CreateCharacterPage />
          </Suspense>
        ),
      },
      {
        path: 'character/:id',
        element: (
          <Suspense fallback={<Spinner />}>
            <CharacterSheet />
          </Suspense>
        ),
      },
      {
        path: 'gm-dashboard',
        element: (
          <Suspense fallback={<Spinner />}>
            <GMDashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/campaigns',
        element: (
          <Suspense fallback={<Spinner />}>
            <GMCampaignListPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/campaigns/create',
        element: (
          <Suspense fallback={<Spinner />}>
            <CreateCampaignPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/ids',
        element: (
          <Suspense fallback={<Spinner />}>
            <ManageIDsPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/systems',
        element: (
          <Suspense fallback={<Spinner />}>
            <ManageSystemsPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/systems/shadowdark',
        element: (
          <Suspense fallback={<Spinner />}>
            <ShadowdarkMenuPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/systems/shadowdark/spells',
        element: (
          <Suspense fallback={<Spinner />}>
            <ShadowdarkSpellsPage />
          </Suspense>
        ),
      },
      {
        path: 'gm/systems/shadowdark/items',
        element: (
          <Suspense fallback={<Spinner />}>
            <ShadowdarkItemsPage />
          </Suspense>
        ),
      },
      {
        path: 'campaigns',
        element: (
          <Suspense fallback={<Spinner />}>
            <PlayerCampaignListPage />
          </Suspense>
        ),
      },
      {
        path: 'campaign/:id',
        element: (
          <Suspense fallback={<Spinner />}>
            <CampaignViewPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
