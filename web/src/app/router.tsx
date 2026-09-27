import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { TransferDashboard } from '../features/redistribution/TransferDashboard';
import { TransferDetail } from '../features/redistribution/TransferDetail';
import { CandidateFacilities } from '../features/redistribution/CandidateFacilities';
import { RouteComparison } from '../features/redistribution/RouteComparison';
import { TransferHistory } from '../features/redistribution/TransferHistory';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <TransferDashboard />,
      },
      {
        path: 'transfers',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'transfers/:id',
        element: <TransferDetail />,
      },
      {
        path: 'transfers/:id/candidates',
        element: <CandidateFacilities />,
      },
      {
        path: 'transfers/:id/route',
        element: <RouteComparison />,
      },
      {
        path: 'history',
        element: <TransferHistory />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
