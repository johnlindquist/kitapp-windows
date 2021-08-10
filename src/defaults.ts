import { UI } from 'kit-bridge/cjs/enum';

export const DEFAULT_WIDTH = 370;
export const DEFAULT_HEIGHT = Math.round((DEFAULT_WIDTH * 11) / 8.5);
export const INPUT_HEIGHT = 64;
export const MIN_HEIGHT = INPUT_HEIGHT;
export const MIN_TEXTAREA_HEIGHT = MIN_HEIGHT * 3;
export const MIN_WIDTH = 320;
export const DROP_HEIGHT = 256;

export const heightMap: { [key in UI]: number } = {
  [UI.none]: INPUT_HEIGHT,
  [UI.arg]: DEFAULT_HEIGHT,
  [UI.textarea]: DEFAULT_HEIGHT,
  [UI.hotkey]: INPUT_HEIGHT,
  [UI.drop]: DROP_HEIGHT,
  [UI.editor]: DEFAULT_HEIGHT,
  [UI.form]: DEFAULT_HEIGHT,
  [UI.div]: DEFAULT_HEIGHT,
  [UI.log]: INPUT_HEIGHT,
};
