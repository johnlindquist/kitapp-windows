import { getAppDb } from '@johnlindquist/kit/cjs/db';
import { app } from 'electron';
import log from 'electron-log';

export const maybeSetLogin = async () => {
  const appDb = await getAppDb();
  const openAtLoginEnabled = appDb.openAtLogin;
  const { openAtLogin } = app.getLoginItemSettings();

  if (openAtLogin !== openAtLoginEnabled) {
    log.info(
      `${
        openAtLoginEnabled
          ? `☑ Enable: Open Kit.app at login`
          : `◽️ Disable: Open Kit.app at login`
      }`
    );
    app.setLoginItemSettings({ openAtLogin: openAtLoginEnabled });
  }
};
