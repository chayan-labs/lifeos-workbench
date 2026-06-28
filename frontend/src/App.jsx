import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Database from './pages/Database';
import Modules from './pages/Modules';
import SelfExtension from './pages/SelfExtension';
import HarnessLoop from './pages/HarnessLoop';
import VcsIngest from './pages/VcsIngest';
import Integrations from './pages/Integrations';
import DocsHub from './pages/DocsHub';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/database"
          element={
            <Layout>
              <Database />
            </Layout>
          }
        />
        <Route
          path="/modules"
          element={
            <Layout>
              <Modules />
            </Layout>
          }
        />
        <Route
          path="/self-extension"
          element={
            <Layout>
              <SelfExtension />
            </Layout>
          }
        />
        <Route
          path="/harness-loop"
          element={
            <Layout>
              <HarnessLoop />
            </Layout>
          }
        />
        <Route
          path="/vcs-ingest"
          element={
            <Layout>
              <VcsIngest />
            </Layout>
          }
        />
        <Route
          path="/integrations"
          element={
            <Layout>
              <Integrations />
            </Layout>
          }
        />
        <Route
          path="/docs"
          element={
            <Layout>
              <DocsHub />
            </Layout>
          }
        />
        <Route
          path="/docs_hub"
          element={
            <Layout>
              <DocsHub />
            </Layout>
          }
        />
        <Route
          path="/docs-hub"
          element={
            <Layout>
              <DocsHub />
            </Layout>
          }
        />
        
        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
