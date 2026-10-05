import { createContext, useContext } from 'react';
import { DEFAULT_SETTINGS } from '../shared/settings';
export const PanelSettings = createContext(DEFAULT_SETTINGS);
export const usePanelSettings = () => useContext(PanelSettings);
