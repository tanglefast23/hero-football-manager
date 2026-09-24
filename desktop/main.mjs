import { BrowserWindow, app } from 'electron';
import {
  createWindow,
  exportRoot,
  installHandler,
  installMenu,
  registerScheme,
} from './shell.mjs';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerScheme();
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.whenReady().then(() => {
    installHandler(exportRoot());
    installMenu();
    createWindow();
  });
}

// A game with no window has nothing to do in the Dock.
app.on('window-all-closed', () => app.quit());
