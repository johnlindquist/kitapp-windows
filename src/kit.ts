/* eslint-disable no-nested-ternary */
/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { app } from 'electron';
import minimist from 'minimist';
import log from 'electron-log';

import { Channel, ProcessType } from 'kit-bridge/cjs/enum';
import { info, kenvPath, kitPath, mainScriptPath } from 'kit-bridge/cjs/util';
import { emitter, KitEvent } from './events';
import { processes } from './process';
import { setPromptPid, setScript } from './prompt';
import { getKitScript, getKenvScript } from './state';

app.on('second-instance', async (_event, argv) => {
  const { _ } = minimist(argv);
  const [, , argScript, ...argArgs] = _;
  processes.add(ProcessType.Background, argScript, argArgs);
});

// process.on('unhandledRejection', (reason, p) => {
//   log.warn('Unhandled Rejection at: Promise', p, 'reason:', reason);

//   // application specific logging, throwing an error, or other logic here
// });

process.on('uncaughtException', (error) => {
  log.warn(`Uncaught Exception: ${error.message}`);
  log.warn(error);
});

emitter.on(KitEvent.SetKenv, () => {
  runPromptProcess(mainScriptPath);
});

const findScript = async (scriptPath: string) => {
  if (scriptPath === mainScriptPath) {
    return getKitScript(mainScriptPath);
  }

  if (scriptPath.startsWith(kitPath())) {
    return getKitScript(scriptPath);
  }

  if (scriptPath.startsWith(kenvPath())) {
    return getKenvScript(scriptPath);
  }

  const script = await info(scriptPath);

  return script;
};

export const runPromptProcess = async (
  promptScriptPath: string,
  args: string[] = []
) => {
  processes.endPreviousPromptProcess();

  const script = await findScript(promptScriptPath);
  // log.info(script);

  await setScript(script);

  const { child, pid } = await processes.findPromptProcess();

  setPromptPid(pid);

  log.info(`🏎 ${promptScriptPath} ${pid}`);
  processes.assignScriptToProcess(promptScriptPath, pid);

  child?.send({
    channel: Channel.VALUE_SUBMITTED,
    value: {
      script: promptScriptPath,
      args,
    },
  });

  processes.add(ProcessType.Prompt);
};

// export const resetIdlePromptProcess = async () => {
//   const { pid } = processes.findPromptProcess();
//   processes.removeByPid(pid);
//   processes.add(ProcessType.Prompt);
// };
