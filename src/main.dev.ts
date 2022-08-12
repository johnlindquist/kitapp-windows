/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */
/* eslint-disable import/first */
/* eslint-disable jest/no-identical-title */
/* eslint-disable jest/expect-expect */
/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./src/main.prod.js` using webpack. This gives us some performance wins.
 */

import { app, protocol, powerMonitor, shell, BrowserWindow } from 'electron';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';

import StreamZip from 'node-stream-zip';
import tar from 'tar';
import clipboardy from 'clipboardy';
import unhandled from 'electron-unhandled';
import { openNewGitHubIssue, debugInfo } from 'electron-util';

unhandled({
  reportButton: (error) => {
    openNewGitHubIssue({
      user: 'johnlindquist',
      repo: 'kit',
      body: `\`\`\`\n${error.stack}\n\`\`\`\n\n---\n\n${debugInfo()}`,
    });
  },
});

if (!app.requestSingleInstanceLock()) {
  app.exit();
}
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'path';
import {
  fork,
  spawn,
  spawnSync,
  SpawnSyncOptions,
  SpawnSyncReturns,
  ForkOptions,
  execSync,
} from 'child_process';
import os, { homedir } from 'os';
import { ensureDir } from 'fs-extra';
import { existsSync } from 'fs';
import {
  chmod,
  lstat,
  readdir,
  readFile,
  rename,
  rm,
  mkdir,
  copyFile,
} from 'fs/promises';

import axios from 'axios';

import { Channel, ProcessType, UI } from '@johnlindquist/kit/cjs/enum';
import { PromptData } from '@johnlindquist/kit/types/core';

import {
  kenvPath,
  kitPath,
  KIT_FIRST_PATH,
  tmpClipboardDir,
  tmpDownloadsDir,
  execPath,
} from '@johnlindquist/kit/cjs/utils';

import { getPrefsDb, getShortcutsDb } from '@johnlindquist/kit/cjs/db';
import { subscribeKey } from 'valtio/utils';

import { createTray, destroyTray } from './tray';
import {
  cacheMenu,
  setupWatchers,
  teardownWatchers,
  watchers,
} from './watcher';
import {
  getArch,
  getAssetPath,
  getNodeVersion,
  getPlatform,
  getPlatformExtension,
  getReleaseChannel,
} from './assets';
import { configureInterval } from './tick';
import {
  clearPromptCache,
  createPromptWindow,
  destroyPromptWindow,
  sendToPrompt,
  setPromptData,
  setPromptPid,
  setScript,
  focusPrompt,
  beforePromptQuit,
} from './prompt';
import { APP_NAME, KIT_PROTOCOL } from './helpers';
import { getVersion, getStoredVersion, storeVersion } from './version';
import { checkForUpdates, configureAutoUpdate, kitIgnore } from './update';
import { INSTALL_ERROR, show } from './show';
import { cacheKitScripts, kitState } from './state';
import { startSK } from './sk';
import { handleWidgetEvents, processes } from './process';
import { startIpc } from './ipc';
import { runPromptProcess } from './kit';
import { showError } from './main.dev.templates';
import { scheduleDownloads, sleepSchedule } from './schedule';
import { maybeSetLogin } from './settings';
import { SPLASH_PATH } from './defaults';
import { registerTrayShortcut } from './shortcuts';

// Disables CSP warnings in browser windows.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

app.setName(APP_NAME);

app.setAsDefaultProtocolClient(KIT_PROTOCOL);
if (app?.dock) {
  app?.dock?.hide();
  app?.dock?.setIcon(getAssetPath('icon.png'));
}
const releaseChannel = getReleaseChannel();
const arch = getArch();
const platform = getPlatform();
const nodeVersion = getNodeVersion();

app.on('will-quit', async () => {
  try {
    teardownWatchers();
    sleepSchedule();
    destroyTray();
  } catch (error) {
    log.error(`😬 ERROR DESTROYING TRAY`, { error });
  }

  try {
    app.removeAllListeners('window-all-closed');
  } catch (error) {
    log.error(error);
  }

  try {
    if (kitState.isMac) await beforePromptQuit();
  } catch (error) {
    log.error(error);
  }

  try {
    log.info(`Destory watcher process`);
    if (watchers?.childWatcher) watchers?.childWatcher?.kill();
  } catch (error) {
    log.error(error);
  }

  try {
    log.info(`Destroy all windows`);
    const browserWindows = BrowserWindow.getAllWindows();
    browserWindows.forEach((browserWindow) => {
      browserWindow?.destroy();
    });
  } catch (e) {
    log.warn(`callBeforeQuitAndInstall error`, e);
  }

  log.info(
    `Remaning browser windows: ${BrowserWindow.getAllWindows()?.length}`
  );
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

log.info(`
Release channel: ${releaseChannel}
Arch: ${arch}
Platform: ${platform}
Node version: ${nodeVersion}
`);

const KIT = kitPath();

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')({ showDevTools: false });
}

// fmkadmapgofadopljbjfkapdkoienihi
const installExtensions = async () => {
  const result = await installExtension(REACT_DEVELOPER_TOOLS, {
    loadExtensionOptions: { allowFileAccess: true },
  }).catch((error) => {
    log.info(`😬 DEVTOOLS INSTALL FAILED`, { error });
  });
  if (result) log.info(`😬 DEVTOOLS INSTALLED`, { result });
};

const cliFromParams = async (cli: string, params: URLSearchParams) => {
  const name = params.get('name');
  const newUrl = params.get('url');
  if (name && newUrl) {
    await runPromptProcess(kitPath(`cli/${cli}.js`), [name, '--url', newUrl]);
    return true;
  }

  const content = params.get('content');

  if (content) {
    await runPromptProcess(kitPath(`cli/${cli}.js`), [
      name || '',
      '--content',
      content,
    ]);
    return true;
  }
  return false;
};

const newFromProtocol = async (u: string) => {
  const url = new URL(u);
  console.log({ url });
  if (url.protocol === 'kit:') {
    const pathname = url.pathname.replace('//', '');
    if (pathname === 'new') {
      await cliFromParams('new', url.searchParams);
    }
    if (pathname === 'snippet' || url.host === 'snippet') {
      await cliFromParams('snippet', url.searchParams);
    }
  }
};

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', async (event, navigationUrl) => {
    const url = new URL(navigationUrl);
    console.log({ url });
    event.preventDefault();

    if (url.host === 'scriptkit.com' && url.pathname === '/api/new') {
      await cliFromParams('new', url.searchParams);
    } else if (url.protocol === 'kit:') {
      await cliFromParams(url.pathname, url.searchParams);
    } else if (url.protocol === 'submit:') {
      sendToPrompt(Channel.SET_SUBMIT_VALUE, url.pathname);
    } else if (url.protocol.startsWith('http')) {
      shell.openExternal(url.href);
    }
  });
});

const prepareProtocols = async () => {
  app.on('open-url', async (e, u) => {
    log.info(`URL PROTOCOL`, u);
    e.preventDefault();
    await newFromProtocol(u);
  });

  protocol.registerFileProtocol(KIT_PROTOCOL, (request, callback) => {
    const url = request.url.substr(KIT_PROTOCOL.length + 2);
    const file = { path: url };

    log.info(`fileProtocol loading:`, file);

    callback(file);
  });

  // session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  //   callback({
  //     responseHeaders: {
  //       'Content-Security-Policy': ["default-src 'self'"],
  //       ...details.responseHeaders,
  //     },
  //   });
  // });
};

const createLogs = () => {
  log.transports.file.resolvePath = () => kitPath('logs', 'kit.log');
};

const sendSplashBody = (message: string) => {
  if (message.includes('object')) return;
  sendToPrompt(Channel.SET_SPLASH_BODY, message);
};

const sendSplashHeader = (message: string) => {
  sendToPrompt(Channel.SET_SPLASH_HEADER, message);
};

const sendSplashProgress = (progress: number) => {
  sendToPrompt(Channel.SET_SPLASH_PROGRESS, progress);
};

const setupDone = () => {
  sendSplashProgress(100);
  sendSplashHeader(`Kit SDK Install verified ✅`);
};

// const configWindowDone = () => {
//   if (configWindow?.isVisible()) {
//     configWindow?.webContents.send('UPDATE', {
//       header: `Script Kit ${getVersion()}`,
//       spinner: false,
//       message: `
//   <div class="flex flex-col justify-center items-center px-8">
//     <div><span class="font-bold"><kbd>cmd</kbd> <kbd>;</kbd></span> to launch main prompt (or click tray icon)</div>
//     <div>Right-click tray icon for options</div>
//   </div>
//   `.trim(),
//     });
//     configWindow?.on('blur', () => {
//       if (!configWindow?.webContents?.isDevToolsOpened()) {
//         configWindow?.destroy();
//       }
//     });
//   } else {
//     configWindow?.destroy();
//   }
// };

const setupLog = async (message: string) => {
  sendSplashBody(message);
  log.info(message);
  if (process.env.KIT_SPLASH) {
    await new Promise((resolve, reject) =>
      setTimeout(() => {
        resolve(true);
      }, 500)
    );
  }
};

const forkOptions: ForkOptions = {
  cwd: homedir(),
  env: {
    KIT,
    KENV: kenvPath(),
    PATH: KIT_FIRST_PATH + path.delimiter + process?.env?.PATH,
  },
};

const optionalSetupScript = (...args: string[]) => {
  return new Promise((resolve, reject) => {
    log.info(`Running optional setup script: ${args.join(' ')}`);
    const child = fork(kitPath('run', 'terminal.js'), args, forkOptions);

    child.on('message', (data) => {
      const dataString = typeof data === 'string' ? data : data.toString();

      if (!dataString.includes(`[object`)) {
        log.info(args[0], dataString);
        // sendSplashBody(dataString.slice(0, 200));
      }
    });

    child.on('exit', () => {
      log.info(`✅ Successfully ran setup script: ${args.join(' ')}`);
      resolve('success');
    });

    child.on('error', (error: Error) => {
      log.error(`⚠️ Errored on setup script: ${args.join(' ')}`);
      resolve('error');
      // reject(error);
      // throw new Error(error.message);
    });
  });
};

const ensureKitDirs = async () => {
  await ensureDir(kitPath('logs'));
  await ensureDir(kitPath('db'));
  await ensureDir(tmpClipboardDir);
  await ensureDir(tmpDownloadsDir);
  await getPrefsDb();
  await getShortcutsDb();
};

const ensureKenvDirs = async () => {
  await ensureDir(kenvPath('kenvs'));
  await ensureDir(kenvPath('assets'));
};

const systemEvents = () => {
  powerMonitor.addListener('suspend', async () => {
    log.info(`😴 System suspending. Removing watchers.`);
    teardownWatchers();
    sleepSchedule();

    kitState.suspended = true;
    // app?.hide();
  });

  powerMonitor.addListener('resume', async () => {
    log.info(`🌄 System waking. Starting watchers.`);
    await setupWatchers();

    setTimeout(async () => {
      log.info(`Resume tasks`);
      if (!kitState.updateDownloaded) {
        checkForUpdates();
      }
    }, 5000);

    kitState.suspended = false;
  });

  powerMonitor.addListener('lock-screen', async () => {
    kitState.screenLocked = true;
    // app?.hide();
  });

  powerMonitor.addListener('unlock-screen', async () => {
    kitState.screenLocked = false;
  });
};

const ready = async () => {
  try {
    await ensureKitDirs();
    await ensureKenvDirs();
    createLogs();
    await prepareProtocols();
    await setupLog(`Protocols Prepared`);
    await createTray(true, 'default');

    await maybeSetLogin();
    await setupLog(`Tray created`);

    await setupWatchers();
    await setupLog(`Shortcuts Assigned`);

    if (kitState.isMac) {
      log.info(`💻 Mac detected.`);
    } else {
      kitState.authorized = true;
    }

    if (kitState.authorized) {
      log.info(`💻 Accessibility authorized ✅`);
      await configureInterval();
      await setupLog(`Tick started`);
    } else {
      const id = setInterval(async () => {
        log.silly(`Checking for accessibility authorization...`);
        if (kitState.authorized) {
          clearInterval(id);
          await configureInterval();
          await setupLog(`Tick started`);
        }
      }, 5000);
    }

    await setupLog(``);
    await setupDone();

    const isMac = os.platform() === 'darwin';
    if (isMac) startSK();
    await cacheKitScripts();
    await cacheMenu();

    processes.add(ProcessType.Prompt);
    processes.add(ProcessType.Prompt);
    // processes.add(ProcessType.Prompt);

    handleWidgetEvents();

    scheduleDownloads();

    subscribeKey(kitState, 'lastOpen', async () => {
      scheduleDownloads();
    });

    systemEvents();

    log.info(`NODE_ENV`, process.env.NODE_ENV);
  } catch (error) {
    log.warn(error);
  }
};

const handleSpawnReturns = async (
  message: string,
  result: SpawnSyncReturns<any>,
  required = true
) => {
  console.log(`stdout:`, result?.stdout?.toString());
  console.log(`stderr:`, result?.stderr?.toString());
  const { stdout, stderr, error } = result;

  if (stdout?.toString().length) {
    const out = stdout.toString();
    log.info(message, out);
    sendSplashBody(out.slice(0, 200));
  }

  if (error && required) {
    throw new Error(error.message);
  }

  if (stderr?.toString().length) {
    sendSplashBody(stderr.toString());
    console.log({ stderr: stderr.toString() });
    // throw new Error(stderr.toString());
  }

  return result;
};

const kitExists = async () => {
  setupLog(kitPath());
  const doesKitExist = existsSync(kitPath());

  await setupLog(`kit${doesKitExist ? `` : ` not`} found`);

  return doesKitExist;
};

const kitUserDataExists = async () => {
  const userDataExists = existsSync(app.getPath('userData'));
  await setupLog(`kit user data ${userDataExists ? `` : ` not`} found`);

  return userDataExists;
};

const isContributor = async () => {
  // eslint-disable-next-line no-return-await
  return (await kitExists()) && kitIgnore();
};

const kenvExists = async () => {
  const doesKenvExist = existsSync(kenvPath());
  await setupLog(`kenv${doesKenvExist ? `` : ` not`} found`);

  return doesKenvExist;
};

const kenvConfigured = async () => {
  const isKenvConfigured = existsSync(kenvPath('.env'));
  await setupLog(`kenv is${isKenvConfigured ? `` : ` not`} configured`);

  return isKenvConfigured;
};

const nodeExists = async () => {
  const doesNodeExist = existsSync(execPath);
  await setupLog(`node${doesNodeExist ? `` : ` not`} found`);

  return doesNodeExist;
};

const nodeModulesExists = async () => {
  const doesNodeModulesExist = existsSync(kitPath('node_modules'));
  await setupLog(`node_modules${doesNodeModulesExist ? `` : ` not`} found`);

  return doesNodeModulesExist;
};

const verifyInstall = async () => {
  await setupLog(`Verifying ~/.kit exists:`);
  const checkKit = await kitExists();
  await setupLog(`Verifying ~/.kenv exists:`);
  const checkKenv = await kenvExists();

  const checkNode = await nodeExists();
  await setupLog(checkNode ? `node found` : `node missing`);

  const checkNodeModules = await nodeModulesExists();
  await setupLog(
    checkNodeModules ? `node_modules found` : `node_modules missing`
  );

  const isKenvConfigured = await kenvConfigured();
  await setupLog(isKenvConfigured ? `kenv .env found` : `kenv .env missinag`);

  if (
    checkKit &&
    checkKenv &&
    checkNode &&
    checkNodeModules &&
    isKenvConfigured
  ) {
    await setupLog(`Install verified`);
    return true;
  }

  throw new Error(`Install not verified...`);
};

const ohNo = async (error: Error) => {
  log.warn(error.message);
  log.warn(error.stack);
  const mainLog = await readFile(
    path.join(os.homedir(), `Library/Logs/Kit/main.log`),
    {
      encoding: 'utf8',
    }
  );

  await clipboardy.write(
    `
${error.message}
${error.stack}
${mainLog}
  `.trim()
  );
  destroyPromptWindow();
  await show(INSTALL_ERROR, showError(error, mainLog));

  throw new Error(error.message);
};

const extractTar = async (tarFile: string, outDir: string) => {
  const { default: tildify } = await import('tildify');
  await setupLog(`Extracting ${path.basename(tarFile)} to ${tildify(outDir)}`);
  await ensureDir(outDir);

  await tar.x({
    file: tarFile,
    C: outDir,
    strip: 1,
  });
};

const versionMismatch = async () => {
  const currentVersion = getVersion();
  await setupLog(`App version: ${currentVersion}`);

  const previousVersion = await getStoredVersion();
  await setupLog(`Previous version: ${previousVersion}`);
  return currentVersion !== previousVersion;
};

const cleanKit = async () => {
  log.info(`🧹 Cleaning ${kitPath()}`);
  const pathToClean = kitPath();

  const keep = (file: string) => file === 'db' || file === 'node_modules';

  // eslint-disable-next-line no-restricted-syntax
  for await (const file of await readdir(pathToClean)) {
    if (keep(file)) {
      log.info(`👍 Keeping ${file}`);
      continue;
    }

    const filePath = path.resolve(pathToClean, file);
    const stat = await lstat(filePath);
    if (stat.isDirectory()) {
      await rm(filePath, { recursive: true, force: true });
      log.info(`🧹 Cleaning dir ${filePath}`);
    } else {
      await rm(filePath);
      log.info(`🧹 Cleaning file ${filePath}`);
    }
  }
};

const cleanUserData = async () => {
  const pathToClean = app.getPath('userData');
  await rm(pathToClean, { recursive: true, force: true });
};

const KIT_NODE_TAR =
  process.env.KIT_NODE_TAR || getAssetPath(`node.${getPlatformExtension()}`);

const checkKit = async () => {
  await createTray(true, 'busy');
  await setupLog(`Tray created`);

  const options: SpawnSyncOptions = {
    cwd: KIT,
    encoding: 'utf-8',
    env: {
      KIT,
      KENV: kenvPath(),
      PATH: KIT_FIRST_PATH + path.delimiter + process?.env?.PATH,
    },
  };

  log.info(`🧐 Checking ${KIT}`, options);

  const setupScript = (...args: string[]) => {
    return new Promise((resolve, reject) => {
      log.info(`🔨 Running Setup Script ${args.join(' ')}`);
      const child = fork(kitPath('run', 'terminal.js'), args, forkOptions);

      child.on('message', (data) => {
        const dataString = data.toString();
        log.info(args[0], dataString);
      });

      child.on('exit', () => {
        log.info(`✅ Successfully ran ${args.join(' ')}`);
        resolve('success');
      });

      child.on('error', (error: Error) => {
        reject(error);
        ohNo(error);
      });
    });
  };

  const showSplash = async () => {
    await setScript({
      name: 'Kit Setup',
      command: 'splash-screen',
      filePath: SPLASH_PATH,
      kenv: '',
      id: 'spash-screen',
      type: ProcessType.Prompt,
      hasPreview: true,
    });

    sendSplashHeader(`Installing Kit SDK and Kit Environment...`);

    setPromptPid(999999);

    setPromptData({
      ignoreBlur: true,
      ui: UI.splash,
    } as PromptData);
    sendSplashBody(`Starting up...`);

    setTimeout(() => {
      focusPrompt();
    }, 500);
  };

  if (process.env.NODE_ENV === 'development') {
    try {
      await installExtensions();
    } catch (error) {
      log.info(`Failed to install extensions`, error);
    }
  }
  startIpc();
  await createPromptWindow();

  await setupLog(`Prompt window created`);

  const isWin = os.platform().startsWith('win');

  await setupLog(`\n\n---------------------------------`);
  await setupLog(`Launching Script Kit  ${getVersion()}`);
  await setupLog(
    `auto updater detected version: ${autoUpdater.currentVersion}`
  );
  log.info(`PATH:`, KIT_FIRST_PATH);
  try {
    configureAutoUpdate();
  } catch (error) {
    log.error(error);
  }
  try {
    await checkForUpdates();
  } catch (error) {
    log.error(error);
  }

  if (process.env.KIT_SPLASH) {
    await showSplash();
  }

  if (!(await kitExists()) || (await getStoredVersion()) === '0.0.0') {
    if (!process.env.KIT_SPLASH) {
      await showSplash();
    }
    kitState.installing = true;
    log.info(`🔥 Starting Kit First Install`);
  }

  const requiresInstall = (await versionMismatch()) || !(await kitExists());
  log.info(`Requires install: ${requiresInstall}`);

  if (await isContributor()) {
    await setupLog(`Welcome fellow contributor! Thanks for all you do!`);
  } else if (requiresInstall) {
    if (await kitExists()) {
      kitState.updateInstalling = true;
      await setupLog(`Cleaning previous .kit`);
      await cleanKit();
    }

    await setupLog(`.kit doesn't exist or isn't on a contributor branch`);
    const kitTar = getAssetPath('kit.tar.gz');
    await extractTar(kitTar, kitPath());

    const knodePath = (...parts: string[]) =>
      path.join(
        process.env.KNODE || path.resolve(homedir(), '.knode'),
        ...parts.filter(Boolean)
      );

    if (!(await nodeExists())) {
      const { default: tildify } = await import('tildify');
      await setupLog(
        `Adding node ${nodeVersion} ${platform} ${arch} ${tildify(knodePath())}`
      );

      if (existsSync(KIT_NODE_TAR)) {
        if (existsSync(knodePath())) {
          await setupLog(`Removing old node ${tildify(knodePath())}`);
          await rm(knodePath(), {
            recursive: true,
            force: true,
          });
        }

        await setupLog(`Create node dir ${tildify(knodePath())}`);
        await mkdir(knodePath());

        log.info(`Found ${KIT_NODE_TAR}. Extracting...`);

        if (platform === 'win') {
          log.info(`Extracting ${KIT_NODE_TAR} to ${tildify(knodePath())}`);

          try {
            // const copyPath = path.resolve(homedir(), 'node.zip');
            // await copyFile(KIT_NODE_TAR, copyPath);
            // const d = await Open.file(copyPath);
            // await d.extract({ path: knodePath(), concurrency: 5 });
            /* eslint-disable new-cap */
            const zip = new StreamZip.async({ file: KIT_NODE_TAR });

            await zip.extract(null, knodePath());
            await zip.close();

            const nodeDir = await readdir(knodePath());
            const nodeDirName = nodeDir.find((n) => n.startsWith('node-'));
            if (nodeDirName) {
              await rename(knodePath(nodeDirName), knodePath('bin'));
              log.info(await readdir(knodePath('bin')));
              await chmod(knodePath('bin', 'npm.cmd'), 0o755);
              await chmod(knodePath('bin', 'node.exe'), 0o755);
            } else {
              log.warn(`Couldn't find node dir in ${nodeDir}`);
            }
          } catch (error) {
            log.error(error);
          }
        }

        if (platform === 'darwin') {
          await tar.x({
            file: KIT_NODE_TAR,
            C: knodePath(),
            strip: 1,
          });
        }

        if (platform === 'linux') {
          const extractNode = spawnSync(
            `tar --strip-components 1 -xf '${getAssetPath(
              'node.tar.xz'
            )}' --directory '${knodePath}'`,
            {
              shell: true,
            }
          );

          await handleSpawnReturns(`extract node`, extractNode);
          // await tar.x({
          //   file: KIT_NODE_TAR,
          //   C: kitPath('node'),
          //   strip: 1,
          // });
        }
      } else {
        const installScript = `./build/install-node.sh`;
        await chmod(kitPath(installScript), 0o755);
        const nodeInstallResult = spawnSync(
          installScript,
          ` --prefix node --platform darwin`.split(' '),
          options
        );
        await handleSpawnReturns(`install-node.sh`, nodeInstallResult);
      }
    }
    await setupLog(`updating ~/.kit packages...`);
    log.info(`PATH:`, options?.env?.PATH);

    if (isWin) {
      const npmResult = await new Promise((resolve, reject) => {
        const child = fork(
          knodePath('bin', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
          [`i`, `--production`, `--no-progress`, `--quiet`],
          options
        );
        child.on('message', (data) => {
          sendSplashBody(data.toString());
        });
        child.on('exit', () => {
          resolve('npm install success');
        });
        child.on('error', (error) => {
          reject(error);
        });
      });
      // const kitAppResult = await new Promise((resolve, reject) => {
      //   const child = fork(
      //     kitPath('node', 'bin', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      //     [`i`, `@johnlindquist/kitdeps@0.0.1`, `--no-progress`, `--quiet`],
      //     options
      //   );
      //   child.on('message', (data) => {
      //     sendSplashBody(data.toString());
      //   });
      //   child.on('exit', () => {
      //     resolve('npm install success');
      //   });
      //   child.on('error', (error) => {
      //     reject(error);
      //   });
      // });
    } else {
      const npmResult = await new Promise((resolve, reject) => {
        const child = spawn(
          knodePath('bin', 'npm'),
          [`i`, `--production`, `--no-progress`, `--quiet`],
          options
        );
        child.on('message', (data: any) => {
          sendSplashBody(data.toString());
        });
        child.on('exit', (code) => {
          resolve(`Deps install exit code ${code}`);
        });
        child.on('error', (error: any) => {
          reject(error);
        });
      });
      log.info({ npmResult });
    }

    await setupScript(kitPath('setup', 'chmod-helpers.js'));
    await clearPromptCache();
  }

  // await handleSpawnReturns(`docs-pull`, pullDocsResult);

  if (!(await kenvExists())) {
    // Step 4: Use kit wrapper to run setup.js script
    // configWindow?.show();
    await setupLog(`Extract tar to ~/.kenv...`);
    const kenvTar = getAssetPath('kenv.tar.gz');
    await extractTar(kenvTar, kenvPath());
    log.info(await readdir(kenvPath()));

    await kenvExists();
    await ensureKenvDirs();

    optionalSetupScript(kitPath('setup', 'clone-examples.js'));
  }

  if (!(await kenvConfigured())) {
    await setupLog(`Run .kenv setup script...`);
    await setupScript(kitPath('setup', 'setup.js'));
    await kenvConfigured();
  }

  await setupLog(`Update .kenv`);
  await setupScript(kitPath('setup', 'patch.js'));

  await setupLog(`Indexing apps`);
  optionalSetupScript(kitPath('setup', 'app-indexer.js'));

  await setupLog(`Creating bins`);
  optionalSetupScript(kitPath('cli', 'create-all-bins-no-trash.js'));

  let status = 'success';
  let err = '';

  try {
    await verifyInstall();

    await storeVersion(getVersion());

    kitState.starting = false;
    kitState.updateInstalling = false;
    kitState.installing = false;

    log.info(`kitState`, kitState);

    registerTrayShortcut();

    await ready();
    kitState.ready = true;
    setTimeout(() => {
      kitState.settled = true;
    }, 4000);
    sendToPrompt(Channel.SET_READY, true);

    focusPrompt();
  } catch (error) {
    ohNo(error);
    status = 'fail';
    err = error.toString();
  }

  if (requiresInstall) {
    const installInfo = {
      version: getVersion(),
      username: os.userInfo().username,
      status,
      platform,
      timestamp: Date.now(),
      osversion: os.version(),
      err,
    };

    try {
      await axios.post(`https://scriptkit.com/api/installs`, installInfo);
    } catch {
      log.info(`Could not post install info`);
    }
  }
};

try {
  log.info(`🧹 Cleaning abandonned 'Kit Helper' processes`);
  // execSync(`pkill -f 'Kit Helper'`);
} catch (error) {
  log.info(`👍 No abandonned 'Kit Helper' processes found`);
}

app.whenReady().then(checkKit).catch(ohNo);
