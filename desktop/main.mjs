import { app } from 'electron';
import {
  createWindow,
  exportRoot,
  installHandler,
  registerScheme,
} from './shell.mjs';

registerScheme();

app.whenReady().then(() => {
  installHandler(exportRoot());
  createWindow();
});

// A game with no window has nothing to do in the Dock.
app.on('window-all-closed', () => app.quit());
