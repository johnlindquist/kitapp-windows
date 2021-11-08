/* eslint-disable import/prefer-default-export */
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  nativeTheme,
  screen,
} from 'electron';
import { writeFile, mkdir } from 'fs/promises';
import { kenvPath, isDir } from '@johnlindquist/kit/cjs/utils';
import { getAssetPath } from './assets';

const page = (body: string) => {
  const baseURL = app.getAppPath().replace('\\', '/');
  const stylePath = `${baseURL}/dist/style.css`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${stylePath}">
    <script>

    const {ipcRenderer} = require("electron")

    ipcRenderer.on('UPDATE', (event, {message, header, spinner})=> {
      if(header) document.querySelector(".header").innerHTML = header
      if(message) document.querySelector(".message").innerHTML = message
      if(typeof spinner === "boolean") document.querySelector(".spinner").classList[spinner ? "remove" : "add"]("hidden")
    })
    </script>
</head>
    ${body}
</html>`;
};

const getCenterOnCurrentScreen = (
  options: BrowserWindowConstructorOptions = {}
) => {
  const cursor = screen.getCursorScreenPoint();
  // Get display with cursor
  const distScreen = screen.getDisplayNearestPoint({
    x: cursor.x,
    y: cursor.y,
  });

  const { width: screenWidth, height: screenHeight } = distScreen.workAreaSize;
  const width = options?.width || 480;
  const height = options?.height || 360;
  const x = distScreen.workArea.x + Math.floor(screenWidth / 2 - width / 2); // * distScreen.scaleFactor
  const y = distScreen.workArea.y + Math.floor(screenHeight / 2 - height / 2);

  return {
    width,
    height,
    x,
    y,
  };
};

export const showDevTools = async (value: any) => {
  const center = getCenterOnCurrentScreen({ width: 800, height: 600 });

  const devToolsWindow = new BrowserWindow({
    ...center,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    transparent: true,
    vibrancy: 'menu',
    visualEffectState: 'active',
    show: false,
    width: 0,
    height: 0,
  });
  devToolsWindow.webContents.openDevTools({
    mode: 'detach',
  });

  devToolsWindow.webContents.setZoomFactor(1.5);

  devToolsWindow.webContents.focus();

  if (value) {
    devToolsWindow.webContents.send('DEVTOOLS', value);
  }

  // devToolsWindow.webContents.once('did-finish-load', () => {
  // });

  devToolsWindow.show();

  devToolsWindow.loadURL(`file://${__dirname}/devTools.html`);

  devToolsWindow.webContents.on('devtools-closed', () => {
    console.log(`Destroy dev tools window`);
    devToolsWindow?.destroy();
  });

  // devToolsWindow.on('blur', () => {});

  // debug.detach();
};

export const show = async (
  name: string,
  html: string,
  options: BrowserWindowConstructorOptions = {},
  showOnLoad = true
): Promise<BrowserWindow> => {
  const center = getCenterOnCurrentScreen(options);
  const showWindow = new BrowserWindow({
    title: name,
    frame: false,
    transparent: true,
    vibrancy: 'menu',
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    ...center,
    show: false,
    ...options,
  });

  showWindow?.setMaxListeners(2);

  showWindow?.webContents.on('before-input-event', (event: any, input) => {
    if (input.key === 'Escape') {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      showWindow.destroy();
      if (
        BrowserWindow.getAllWindows().every((window) => !window.isVisible())
      ) {
        app?.hide();
      }
    }
  });

  const showParentDir = (await isDir(kenvPath('tmp')))
    ? kenvPath('tmp', name)
    : app.getPath('appData');

  if (!(await isDir(showParentDir))) {
    await mkdir(showParentDir, { recursive: true });
  }

  const showPath = `${showParentDir}/${name}.html`;
  await writeFile(showPath, page(html));

  return new Promise((resolve, reject) => {
    showWindow.webContents.once('did-finish-load', () => {
      if (showOnLoad && showWindow) {
        showWindow?.show();
      }

      resolve(showWindow);
    });

    showWindow?.loadURL(`file://${showPath}`);
  });
};
