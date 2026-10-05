import { connectSearchPanel } from '../panel/search/transport';
import { PANEL_TITLE } from '../shared/constants';

chrome.devtools.panels.create(PANEL_TITLE, 'icons/black-32.png', 'panel.html', connectSearchPanel);
