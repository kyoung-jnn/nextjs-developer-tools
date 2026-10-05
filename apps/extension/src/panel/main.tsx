import { createRoot } from 'react-dom/client';
import { PanelApp } from './PanelApp';
import { chromeActions } from './platform';
import { createPortSource } from './portSource';
import './panel.css';

const root = document.getElementById('root');
if (root)
  createRoot(root).render(<PanelApp source={createPortSource()} actions={chromeActions()} />);
