/* eslint-disable jsx-a11y/no-autofocus */
/* eslint-disable react/prop-types */
import React, { KeyboardEvent, useCallback, useRef } from 'react';

import { useAtom } from 'jotai';
import { placeholderAtom, selectedAtom } from '../jotai';
import { useEscape } from '../hooks';

interface HotkeyProps {
  submit(data: any): void;
  onHotkeyHeightChanged: (height: number) => void;
}

const DEFAULT_PLACEHOLDER = 'Press a combination of keys';

const keyFromCode = (code: string) => {
  const keyCode = code.replace(/Key|Digit/, '').toLowerCase();
  const replaceAlts = (k: string) => {
    const map: any = {
      backslash: '\\',
      slash: '/',
      quote: `'`,
      backquote: '`',
      equal: `=`,
      minus: `-`,
      period: `.`,
      comma: `,`,
      bracketleft: `[`,
      bracketright: `]`,
      space: 'space',
      semicolon: ';',
    };

    if (map[k]) return map[k];

    return k;
  };

  return replaceAlts(keyCode);
};
const getModifierString = (event: KeyboardEvent<HTMLInputElement>) => {
  const superKey = event.getModifierState('Super');

  const {
    metaKey: command,
    shiftKey: shift,
    ctrlKey: control,
    altKey: option,
  } = event;
  return `${command ? `command ` : ``}${shift ? `shift ` : ``}${
    option ? `option ` : ``
  }${control ? `control ` : ``}${superKey ? `super ` : ``}`;
};

const getKeyData = (event: KeyboardEvent<HTMLInputElement>) => {
  const {
    key,
    code,
    metaKey: command,
    shiftKey: shift,
    ctrlKey: control,
    altKey: option,
  } = event;
  const superKey = event.getModifierState('Super');
  const normalKey = option ? keyFromCode(code) : key;

  const modifierString = getModifierString(event);

  const keyData = {
    key: normalKey,
    command,
    shift,
    option,
    control,
    fn: event.getModifierState('Fn'),
    // fnLock: event.getModifierState('FnLock'),
    // numLock: event.getModifierState('NumLock'),
    hyper: event.getModifierState('Hyper'),
    os: event.getModifierState('OS'),
    super: superKey,
    win: event.getModifierState('Win'),
    // scrollLock: event.getModifierState('ScrollLock'),
    // scroll: event.getModifierState('Scroll'),
    // capsLock: event.getModifierState('CapsLock'),
    shortcut: `${modifierString}${normalKey}`,
  };

  return { modifierString, keyData };
};

export default function Hotkey({ submit, onHotkeyHeightChanged }: HotkeyProps) {
  const containerRef = useRef<HTMLInputElement>(null);
  const [placeholder, setPlaceholder] = useAtom(placeholderAtom);
  const [, setSelected] = useAtom(selectedAtom);

  useEscape();

  const onKeyUp = useCallback(
    (event) => {
      event.preventDefault();
      const modifierString = getModifierString(event);
      setSelected(modifierString);
    },
    [setSelected]
  );

  const onKeyDown = useCallback(
    (event) => {
      event.preventDefault();

      const { keyData, modifierString } = getKeyData(event);

      setSelected(modifierString);

      if (event.key === 'Escape') {
        return;
      }

      if (
        event.key.length === 1 ||
        ['Shift', 'Control', 'Alt', 'Meta'].every((m) => !event.key.includes(m))
      ) {
        submit(keyData);
      }
    },
    [setSelected, submit]
  );

  return (
    <input
      ref={containerRef}
      style={
        {
          WebkitAppRegion: 'drag',
          WebkitUserSelect: 'none',
          minHeight: '4rem',
          caretColor: 'transparent',
        } as any
      }
      autoFocus
      className={`
      hotkey-component
      bg-transparent w-full text-black dark:text-white focus:outline-none outline-none text-xl dark:placeholder-white dark:placeholder-opacity-40 placeholder-black placeholder-opacity-40 h-16
  ring-0 ring-opacity-0 focus:ring-0 focus:ring-opacity-0 pl-4 py-0
  focus:border-none border-none`}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      placeholder={placeholder || DEFAULT_PLACEHOLDER}
    />
  );
}
