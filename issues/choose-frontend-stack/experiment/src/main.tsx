import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Conversation, fixtureState } from './App';
import { makeStore } from './state';

const root = document.getElementById('root');
if (!root) throw new Error('root element is missing');

createRoot(root).render(
  <StrictMode>
    <Provider store={makeStore(fixtureState)}>
      <BrowserRouter>
        <Routes>
          <Route path="/servers/:serverId/workspaces/:workspaceId/agents/:agentId" element={<Conversation />} />
          <Route path="*" element={<Navigate replace to="/servers/alder/workspaces/redacted/agents/pi-redacted" />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
