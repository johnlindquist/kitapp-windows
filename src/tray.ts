/* eslint-disable import/prefer-default-export */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-loop-func */
import {
  Notification,
  Tray,
  Menu,
  app,
  MenuItemConstructorOptions,
  globalShortcut,
} from 'electron';
import path from 'path';
import log, { LogLevel } from 'electron-log';
import { KitStatus, Status } from '@johnlindquist/kit/types/kitapp';
import { subscribeKey } from 'valtio/utils';
import { KeyboardEvent } from 'electron/main';
import os from 'os';
import {
  kenvPath,
  kitPath,
  mainScriptPath,
  isFile,
  getLogFromScriptPath,
} from '@johnlindquist/kit/cjs/utils';
import { getAppDb, getScriptsDb } from '@johnlindquist/kit/cjs/db';
import { getAssetPath } from './assets';
import { kitState, restartIfNecessary } from './state';
import { emitter, KitEvent } from './events';
import { getVersion } from './version';

let tray: Tray | null = null;

export const openMenu = async (event?: KeyboardEvent) => {
  log.verbose(`🎨 Menu state: ${kitState.trayOpen ? 'open' : 'closed'}`);
  if (kitState.trayOpen) {
    tray?.closeContextMenu();
    kitState.trayOpen = false;
    return;
  }
  await restartIfNecessary();
  if (event?.metaKey) {
    emitter.emit(
      KitEvent.RunPromptProcess,
      kenvPath('app', 'command-click.js')
    );
  } else if (event?.shiftKey) {
    emitter.emit(KitEvent.RunPromptProcess, kenvPath('app', 'shift-click.js'));
  } else if (event?.ctrlKey) {
    emitter.emit(
      KitEvent.RunPromptProcess,
      kenvPath('app', 'control-click.js')
    );
  } else if (event?.altKey) {
    emitter.emit(KitEvent.RunPromptProcess, kenvPath('app', 'alt-click.js'));
  } else {
    // emitter.emit(KitEvent.RunPromptProcess, mainScriptPath);

    const updateMenu: MenuItemConstructorOptions = {
      label: 'Check for Updates',
      click: async () => {
        emitter.emit(KitEvent.CheckForUpdates, true);
      },
    };

    // if (kitState.starting) {
    //   updateMenu = {
    //     label: 'Starting up...',
    //     icon: menuIcon('green'),
    //   };
    // }

    // if (kitState.updateDownloading) {
    //   updateMenu = {
    //     label: 'Update downloading. Will auto-restart when complete.',
    //     icon: menuIcon('orange'),
    //   };
    // }

    // if (kitState.updateError) {
    //   updateMenu = {
    //     label: 'Update download failed. Check logs...',
    //     icon: menuIcon('red'),
    //   };
    // }

    const runScript = (script: string) => () => {
      emitter.emit(KitEvent.RunPromptProcess, script);
    };

    const notifyItems: MenuItemConstructorOptions[] = [];

    for (const { status, message } of [...kitState.notifications].reverse()) {
      notifyItems.push({
        label: message,
        icon: menuIcon(status as iconType),
        click: runScript(kitPath('help', 'reveal-kit-log.js')),
      });
    }

    if (notifyItems.length) {
      notifyItems.push({
        type: 'separator',
      });
    }

    const authItems: MenuItemConstructorOptions[] = [];
    const updateItems: MenuItemConstructorOptions[] = [];

    if (!kitState.authorized) {
      authItems.push({
        label: `Learn More About Permissions`,
        click: runScript(kitPath('help', 'authorized-info.js')),
        icon: menuIcon('open_in_new'),
      });

      authItems.push({
        type: 'separator',
      });
    }

    if (kitState.updateDownloaded) {
      updateItems.push({
        label: `Update Downloaded. Click to install.`,
        click: () => {
          kitState.applyUpdate = true;
        },
        icon: menuIcon('cogwheel'),
      });

      updateItems.push({
        type: 'separator',
      });
    }

    const runningScripts: MenuItemConstructorOptions[] = [];

    if (kitState.ps.find((p) => p?.scriptPath)) {
      runningScripts.push({
        type: 'separator',
      });

      runningScripts.push({
        label: 'Running Proccesses',
        enabled: false,
      });

      for await (const { pid, scriptPath } of kitState.ps) {
        if (scriptPath) {
          const logItems: MenuItemConstructorOptions[] = [];
          const maybeLog = getLogFromScriptPath(scriptPath);

          const logExists = await isFile(maybeLog);

          if (logExists) {
            logItems.push({
              label: 'View Log',
              click: () => {
                emitter.emit(KitEvent.OpenLog, scriptPath as string);
              },
            });
          }
          runningScripts.push({
            label: path.basename(scriptPath as string),
            submenu: [
              {
                label: 'Terminate',
                click: () => {
                  emitter.emit(KitEvent.KillProcess, pid);
                },
              },
              ...logItems,
              {
                label: 'Edit',
                click: () => {
                  emitter.emit(KitEvent.OpenScript, scriptPath as string);
                },
              },
            ],
          });
        }
      }

      runningScripts.push({
        type: 'separator',
      });
    }

    const toolsSubmenu: MenuItemConstructorOptions[] = [];

    toolsSubmenu.push({
      label: `Open Dev Tools`,
      click: async () => {
        emitter.emit(KitEvent.OpenDevTools);
      },
    });

    toolsSubmenu.push(
      {
        type: 'separator',
      },
      {
        label: `Reveal ~/.kit/logs/kit.log in Finder`,
        click: runScript(kitPath('help', 'reveal-kit-log.js')),
      },
      {
        label: `Adjust Log Level`,
        submenu: log.levels.map(
          (level) =>
            ({
              label: level,
              click: () => {
                kitState.logLevel = level as LogLevel;
              },
              enabled: kitState.logLevel !== level,
            } as MenuItemConstructorOptions)
        ),
      }
    );

    if (kitState.isMac) {
      toolsSubmenu.push({
        label: `Watch kit.log in Terminal`,
        click: runScript(kitPath('help', 'tail-log.js')),
      });
    }

    toolsSubmenu.push({
      type: 'separator',
    });

    toolsSubmenu.push({
      label: `Reveal ~/.kenv in Finder`,
      click: runScript(kitPath('help', 'reveal-kenv.js')),
    });

    toolsSubmenu.push({
      label: `Reset Prompt Positions`,
      click: async () => {
        log.info('Resetting prompt cache');
        runScript(kitPath('cli', 'kit-clear-prompt.js'));
      },
    });

    toolsSubmenu.push({
      label: `Prevent Close on Blur`,
      type: 'checkbox',
      click: () => {
        log.info(
          `Toggling ignoreBlur to ${!kitState.preventClose ? 'true' : 'false'}`
        );
        kitState.preventClose = !kitState.preventClose;
      },
      checked: kitState.preventClose,
    });

    const contextMenu = Menu.buildFromTemplate([
      ...notifyItems,
      ...authItems,
      {
        label: `Open Kit.app Prompt`,
        // icon: getAssetPath(`IconTemplate${isWin ? `-win` : ``}.png`),
        icon: menuIcon('open'),
        click: runScript(mainScriptPath),
        accelerator: kitState.mainShortcut,
      },
      {
        type: 'separator',
      },
      {
        label: `Join Community`,
        click: runScript(kitPath('help', 'get-help.js')),
        icon: menuIcon('github'),
      },
      {
        label: `Subscribe to the Newsletter`,
        click: runScript(kitPath('help', 'join.js')),
        icon: menuIcon('newsletter'),
      },
      {
        label: `Follow on Twitter`,
        click: runScript(kitPath('help', 'follow.js')),
        icon: menuIcon('twitter'),
      },
      {
        label: `Browse Community Scripts`,
        click: runScript(kitPath('cli', 'browse-examples.js')),
        icon: menuIcon('browse'),
      },
      {
        type: 'separator',
      },
      {
        label: `Script Kit ${getVersion()}`,
        enabled: false,
      },
      {
        label: `Dev Tools`,
        submenu: toolsSubmenu,
      },
      updateMenu,
      {
        type: 'separator',
      },
      {
        label: `Change Shortcut`,
        click: runScript(kitPath('cli', 'change-main-shortcut.js')),
      },
      ...runningScripts,
      {
        label: 'Quit',
        click: () => {
          kitState.allowQuit = true;
          log.info(`Quitting...`);
          app.quit();
          app.exit();
        },
      },
    ]);
    contextMenu.once('menu-will-close', () => {
      kitState.status = {
        status: 'default',
        message: '',
      };
      kitState.notifyAuthFail = false;
      kitState.trayOpen = false;
    });
    tray?.popUpContextMenu(contextMenu);
    kitState.trayOpen = true;
  }
  // emitter.emit(KitEvent.RunPromptProcess, kitPath('main', 'kit.js'));
};

const isWin = os.platform() === 'win32';

const trayIcon = (status: Status) => {
  log.info(`🎨 Tray icon: ${status}`);
  if (isWin) return getAssetPath(`tray`, `default-win-Template.png`);

  return getAssetPath(`tray`, `${status}-Template.png`);
};

type iconType =
  | 'alarm'
  | 'browse'
  | 'bug'
  | 'cogwheel'
  | 'discord'
  | 'github'
  | 'help-alt'
  | 'help'
  | 'newsletter'
  | 'open'
  | 'open_in_new'
  | 'twitter'
  | Status;

const menuIcon = (name: iconType) => {
  return getAssetPath(`menu`, `${name}-Template.png`);
};

export const getTrayIcon = () => trayIcon('default');

export const createTray = async (checkDb = false, state: trayState) => {
  log.info(`🎨 Creating tray...`, { checkDb });

  // subscribeKey(kitState, 'isDark', () => {
  //   tray?.setImage(trayIcon('default'));
  //   kitState.notifyAuthFail = false;
  // });

  // subscribeKey(kitState, 'transparencyEnabled', () => {
  //   tray?.setImage(trayIcon('default'));
  //   kitState.notifyAuthFail = false;
  // });

  // subscribeKey(kitState, 'notifyAuthFail', (fail) => {
  //   if (fail) {
  //     tray?.setImage(trayIcon('warn'));
  //   } else {
  //     tray?.setImage(trayIcon('default'));
  //   }
  // });

  if (tray) {
    tray.removeAllListeners();
  }

  if (!tray) {
    tray = new Tray(trayIcon(state));
    tray.setIgnoreDoubleClickEvents(true);

    subscribeKey(kitState, 'status', (status: KitStatus) => {
      tray?.setImage(trayIcon(status.status));
    });
  }
  if (kitState.starting) {
    const startingMenu = () => {
      log.verbose(`🎨 Starting menu...`);
      const message = kitState.installing
        ? 'Installing Kit SDK...'
        : kitState.updateInstalling
        ? 'Applying Update...'
        : 'Starting...';

      kitState.status = {
        status: 'busy',
        message,
      };

      if (kitState.trayOpen) {
        tray?.closeContextMenu();
        kitState.trayOpen = false;
      } else {
        tray?.popUpContextMenu(
          Menu.buildFromTemplate([
            {
              label: `Script Kit ${getVersion()}`,
              accelerator: kitState.mainShortcut,
              enabled: false,
            },
            {
              label: message,
              icon: menuIcon('busy'),
            },
          ])
        );
        kitState.trayOpen = true;
      }
    };

    tray.on('mouse-down', startingMenu);
    tray.on('right-click', startingMenu);

    globalShortcut.register('CommandOrControl+;', startingMenu);
  } else {
    if (!kitState.ready) {
      globalShortcut.unregister('CommandOrControl+;');
    }
    const appDb = await getAppDb();
    if (checkDb && typeof appDb?.tray === 'boolean' && appDb.tray === false) {
      const notification = new Notification({
        title: `Kit.app started with icon hidden`,
        body: `${getVersion()}`,
        silent: true,
      });

      notification.show();
      return;
    }
    try {
      log.info(`☑ Enable tray`);

      tray.on('mouse-down', openMenu);
      tray.on('right-click', openMenu);
    } catch (error) {
      log.error(error);
    }
  }
};

export const getTray = (): Tray | null => tray;

export const destroyTray = () => {
  log.info(`◽️ Disable tray`);
  if (tray) {
    tray?.destroy();
    tray = null;
  }
};

export const toggleTray = async () => {
  const appDb = await getAppDb();
  const trayEnabled = appDb.tray;
  const changed = Boolean(tray) !== trayEnabled;
  if (changed) {
    if (tray) {
      destroyTray();
    } else {
      createTray(false, 'default');
    }
  }
};

let leftClickOverride: null | ((event: any) => void) = null;
export const setTrayMenu = async (scripts: string[]) => {
  if (!scripts?.length) {
    if (leftClickOverride) {
      tray?.off('mouse-down', leftClickOverride);
      tray?.on('mouse-down', openMenu);
      leftClickOverride = null;
      tray?.setContextMenu(null);
    }
    return;
  }

  const db = await getScriptsDb();
  const scriptMenuItems = [];
  for (const command of scripts) {
    const script = db.scripts.find((s) => s.command === command);
    if (script) {
      scriptMenuItems.push({
        label: script.name,
        click: () => {
          emitter.emit(KitEvent.RunPromptProcess, script.filePath);
        },
      });
    }
  }

  if (scriptMenuItems.length) {
    const cMenu = Menu.buildFromTemplate(scriptMenuItems);

    leftClickOverride = () => {
      tray?.popUpContextMenu(cMenu);
      kitState.trayOpen = true;
    };

    tray?.off('mouse-down', openMenu);
    tray?.on('mouse-down', leftClickOverride);
  }
};

emitter.on(KitEvent.TrayClick, openMenu);
