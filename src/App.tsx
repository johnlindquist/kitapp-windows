/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-bitwise */
/* eslint-disable react/no-danger */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable jsx-a11y/no-autofocus */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, {
  ErrorInfo,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import path from 'path';
import { loader } from '@monaco-editor/react';

import { useAtom } from 'jotai';
import AutoSizer from 'react-virtualized-auto-sizer';
import useResizeObserver from '@react-hook/resize-observer';
import { ipcRenderer } from 'electron';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';

import { Channel, UI } from '@johnlindquist/kit/cjs/enum';
import { ChannelMap, KeyData } from '@johnlindquist/kit/types/kitapp';
import Tabs from './components/tabs';
import List from './components/list';
import Input from './components/input';
import ActionBar from './components/actionbar';
import Drop from './components/drop';
import Editor from './components/editor';
import Hotkey from './components/hotkey';
import Hint from './components/hint';
import Selected from './components/selected';
import TextArea from './components/textarea';
import Panel from './components/panel';
import Log from './components/log';
import Header from './components/header';
import Form from './components/form';
import {
  editorConfigAtom,
  flagsAtom,
  formDataAtom,
  formHTMLAtom,
  hintAtom,
  inputAtom,
  isMouseDownAtom,
  isMainScriptAtom,
  logHTMLAtom,
  mainHeightAtom,
  mouseEnabledAtom,
  openAtom,
  panelHTMLAtom,
  pidAtom,
  placeholderAtom,
  previewHTMLAtom,
  promptDataAtom,
  scriptAtom,
  submitValueAtom,
  tabIndexAtom,
  _tabs,
  textareaConfigAtom,
  themeAtom,
  topHeightAtom,
  uiAtom,
  unfilteredChoicesAtom,
  topRefAtom,
  _description,
  _name,
  textareaValueAtom,
  loadingAtom,
  processingAtom,
  exitAtom,
  appConfigAtom,
  splashBodyAtom,
  splashHeaderAtom,
  splashProgressAtom,
  isReadyAtom,
  resizeEnabledAtom,
  valueInvalidAtom,
  isHiddenAtom,
  _history,
  filterInputAtom,
  blurAtom,
  startAtom,
  _logo,
  getEditorHistoryAtom,
  scoredChoices,
  showTabsAtom,
  showSelectedAtom,
  nullChoicesAtom,
  processesAtom,
  setFocusedChoiceAtom,
  socketURLAtom,
  footerAtom,
  onPasteAtom,
  onDropAtom,
  resizeAtom,
} from './jotai';

import { useEscape, useShortcuts, useThemeDetector } from './hooks';
import Splash from './components/splash';
import { AppChannel } from './enums';
import Terminal from './term';

function ensureFirstBackSlash(str: string) {
  return str.length > 0 && str.charAt(0) !== '/' ? `/${str}` : str;
}

function uriFromPath(_path: string) {
  const pathName = path.resolve(_path).replace(/\\/g, '/');
  return encodeURI(`file://${ensureFirstBackSlash(pathName)}`);
}

const vs = uriFromPath(path.join(__dirname, '../assets/vs'));

loader.config({
  paths: {
    vs,
  },
});

class ErrorBoundary extends React.Component {
  // eslint-disable-next-line react/state-in-constructor
  public state: { hasError: boolean; info: ErrorInfo } = {
    hasError: false,
    info: { componentStack: '' },
  };

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Display fallback UI
    this.setState({ hasError: true, info });
    // You can also log the error to an error reporting service
    ipcRenderer.send(Channel.PROMPT_ERROR, { error });
  }

  render() {
    const { hasError, info } = this.state;
    const { children } = this.props;
    if (hasError) {
      return (
        <div className="p-2 font-mono">
          <div className="text-base text-red-500">
            Rendering Error. Opening logs.
          </div>
          <div className="text-xs">{info.componentStack}</div>
        </div>
      );
    }

    return children;
  }
}

export default function App() {
  const [isMainScript] = useAtom(isMainScriptAtom);
  const [appConfig, setAppConfig] = useAtom(appConfigAtom);
  const [, setPid] = useAtom(pidAtom);
  const [open, setOpen] = useAtom(openAtom);
  const [, setExit] = useAtom(exitAtom);
  const [script, setScript] = useAtom(scriptAtom);
  const [, setScriptHistory] = useAtom(_history);

  const [, setInput] = useAtom(inputAtom);
  const [, setPlaceholder] = useAtom(placeholderAtom);
  const [, setPromptData] = useAtom(promptDataAtom);
  const [, setTheme] = useAtom(themeAtom);
  const [, setSplashBody] = useAtom(splashBodyAtom);
  const [, setSplashHeader] = useAtom(splashHeaderAtom);
  const [, setSplashProgress] = useAtom(splashProgressAtom);

  const [, setUnfilteredChoices] = useAtom(unfilteredChoicesAtom);
  const [choices] = useAtom(scoredChoices);

  const [ui] = useAtom(uiAtom);
  const [hint, setHint] = useAtom(hintAtom);
  const [footer, setFooter] = useAtom(footerAtom);

  const [, setReady] = useAtom(isReadyAtom);

  const [, setTabIndex] = useAtom(tabIndexAtom);

  const [panelHTML, setPanelHTML] = useAtom(panelHTMLAtom);
  const [, setPreviewHTML] = useAtom(previewHTMLAtom);
  const [logHtml, setLogHtml] = useAtom(logHTMLAtom);
  const [, setEditorConfig] = useAtom(editorConfigAtom);
  const [, setTextareaConfig] = useAtom(textareaConfigAtom);
  const [flags, setFlags] = useAtom(flagsAtom);
  const [, setMainHeight] = useAtom(mainHeightAtom);
  const [, setTopHeight] = useAtom(topHeightAtom);

  const [, setSubmitValue] = useAtom(submitValueAtom);
  const [, setMouseEnabled] = useAtom(mouseEnabledAtom);
  const [showSelected] = useAtom(showSelectedAtom);
  const [showTabs] = useAtom(showTabsAtom);
  const [, setTopRef] = useAtom(topRefAtom);
  const [, setDescription] = useAtom(_description);
  const [, setName] = useAtom(_name);
  const [, setTextareaValue] = useAtom(textareaValueAtom);
  const [, setLoading] = useAtom(loadingAtom);
  const [processing] = useAtom(processingAtom);
  const [nullChoices] = useAtom(nullChoicesAtom);
  const [resizeEnabled] = useAtom(resizeEnabledAtom);
  const [, setValueInvalid] = useAtom(valueInvalidAtom);
  const [, setFilterInput] = useAtom(filterInputAtom);
  const [, setBlur] = useAtom(blurAtom);
  const [, start] = useAtom(startAtom);
  const [, setLogo] = useAtom(_logo);
  const [getEditorHistory] = useAtom(getEditorHistoryAtom);
  const [, setProcesses] = useAtom(processesAtom);
  const [, setFocused] = useAtom(setFocusedChoiceAtom);
  const [, setSocketURL] = useAtom(socketURLAtom);
  const [onPaste] = useAtom(onPasteAtom);
  const [onDrop] = useAtom(onDropAtom);
  const [, setResize] = useAtom(resizeAtom);
  const [, setTabs] = useAtom(_tabs);

  useShortcuts();

  const mainRef: RefObject<HTMLDivElement> = useRef(null);
  const windowContainerRef: RefObject<HTMLDivElement> = useRef(null);
  const headerRef: RefObject<HTMLDivElement> = useRef(null);

  useResizeObserver(headerRef, (entry) => {
    setTopHeight(entry.contentRect.height);
  });

  useThemeDetector();

  const [, setIsMouseDown] = useAtom(isMouseDownAtom);

  type ChannelAtomMap = {
    [key in keyof ChannelMap]: (data: ChannelMap[key]) => void;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const messageMap: ChannelAtomMap = {
    // [Channel.RESET_PROMPT]: resetPromptHandler,
    [Channel.APP_CONFIG]: setAppConfig,
    [Channel.EXIT]: setExit,
    [Channel.SET_PID]: setPid,
    [Channel.SET_SCRIPT]: setScript,
    [Channel.SET_SCRIPT_HISTORY]: setScriptHistory,
    [Channel.SET_UNFILTERED_CHOICES]: setUnfilteredChoices,
    [Channel.SET_DESCRIPTION]: setDescription,
    [Channel.SET_EDITOR_CONFIG]: setEditorConfig,
    [Channel.SET_TEXTAREA_CONFIG]: setTextareaConfig,
    [Channel.SET_FLAGS]: setFlags,
    [Channel.SET_FOCUSED]: setFocused,
    [Channel.SET_DIV_HTML]: setPanelHTML,
    [Channel.SET_FILTER_INPUT]: setFilterInput,
    [Channel.SET_FOOTER]: setFooter,
    [Channel.SET_HINT]: setHint,
    [Channel.SET_INPUT]: setInput,
    [Channel.SET_LOADING]: setLoading,
    [Channel.SET_NAME]: setName,
    [Channel.SET_TEXTAREA_VALUE]: setTextareaValue,
    [Channel.SET_OPEN]: setOpen,
    [Channel.SET_PANEL]: setPanelHTML,
    [Channel.SET_PREVIEW]: setPreviewHTML,
    [Channel.SET_PROMPT_BLURRED]: setBlur,
    [Channel.SET_LOG]: setLogHtml,
    [Channel.SET_LOGO]: setLogo,
    [Channel.SET_PLACEHOLDER]: setPlaceholder,
    [Channel.SET_READY]: setReady,
    [Channel.SET_RESIZE]: setResize,
    [Channel.SET_SUBMIT_VALUE]: setSubmitValue,
    [Channel.SET_TAB_INDEX]: setTabIndex,
    [Channel.SET_PROMPT_DATA]: setPromptData,
    [Channel.SET_SPLASH_BODY]: setSplashBody,
    [Channel.SET_SPLASH_HEADER]: setSplashHeader,
    [Channel.SET_SPLASH_PROGRESS]: setSplashProgress,
    [Channel.SET_THEME]: setTheme,
    [Channel.VALUE_INVALID]: setValueInvalid,
    [Channel.START]: start,
    [Channel.GET_EDITOR_HISTORY]: getEditorHistory,
    [Channel.TERMINAL]: setSocketURL,
    [Channel.CLEAR_TABS]: setTabs,

    [Channel.SEND_KEYSTROKE]: (keyData: Partial<KeyData>) => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        ctrlKey: keyData.command || keyData.control,
        shiftKey: keyData.shift,
        altKey: keyData.option,
        ...keyData,
      });

      document?.activeElement?.dispatchEvent(keyboardEvent);
    },
  };

  useEffect(() => {
    Object.entries(messageMap).forEach(([key, fn]) => {
      if (ipcRenderer.listenerCount(key) === 0) {
        ipcRenderer.on(key, (_, data) => {
          // if (data?.kitScript) setScriptName(data?.kitScript);
          (fn as (data: ChannelAtomMap[keyof ChannelAtomMap]) => void)(data);
        });
      }
    });

    return () => {
      Object.entries(messageMap).forEach(([key, fn]) => {
        ipcRenderer.off(key, fn);
      });
    };
  }, [messageMap]);

  useEffect(() => {
    ipcRenderer.on(AppChannel.PROCESSES, (_, data) => {
      setProcesses(data);
    });
  }, []);

  const onMouseDown = useCallback(() => {
    setIsMouseDown(true);
  }, [setIsMouseDown]);
  const onMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, [setIsMouseDown]);
  const onMouseLeave = useCallback(() => {
    setIsMouseDown(false);
  }, [setIsMouseDown]);

  const onMouseMove = useCallback(() => {
    setMouseEnabled(1);
  }, [setMouseEnabled]);

  useEffect(() => {
    if (headerRef?.current) setTopRef(headerRef?.current);
  }, [headerRef, setTopRef]);

  // useEffect(() => {
  //   if (windowContainerRef?.current) {
  //     windowContainerRef.current.style.height = `${window.innerHeight}px`;
  //     windowContainerRef.current.style.top = `0px`;
  //     windowContainerRef.current.style.left = `0px`;
  //     // windowContainerRef.current.style.width = window.innerWidth + 'px';
  //   }
  // }, [mainHeight, topHeight, windowContainerRef]);

  const [hidden, setHidden] = useAtom(isHiddenAtom);
  const controls = useAnimation();

  useEffect(() => {
    if (open) {
      controls.start({ opacity: [0, 1] });
    } else {
      controls.stop();
      controls.set({ opacity: 0 });
    }
  }, [open, controls]);

  const showIfOpen = useCallback(() => {
    if (open) setHidden(false);
  }, [open, setHidden]);

  const hideIfClosed = useCallback(() => {
    if (!open) setHidden(true);
  }, [open, setHidden]);

  useEscape();

  return (
    <ErrorBoundary>
      <div
        className={`
        w-screen h-screen
      bg-bg-light dark:bg-bg-dark

      ${
        appConfig.isMac
          ? `
      bg-opacity-themelight
      dark:bg-opacity-themedark
      `
          : `
      bg-opacity-windows-themelight
      dark:bg-opacity-windows-themedark
      `
      }`}
      >
        {/* {JSON.stringify(state)} */}
        <AnimatePresence key="appComponents">
          <motion.div
            animate={controls}
            transition={{ duration: 0.12 }}
            onAnimationStart={showIfOpen}
            onAnimationComplete={hideIfClosed}
            ref={windowContainerRef}
            style={
              {
                WebkitUserSelect: 'none',
              } as any
            }
            className={`
        ${hidden ? 'hidden' : ''}
        flex flex-col
        w-full h-full
        `}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onMouseMove={onMouseMove}
          >
            <header ref={headerRef} className="relative z-10">
              <Header />

              {ui === UI.hotkey && (
                <Hotkey
                  key="AppHotkey"
                  submit={setSubmitValue}
                  onHotkeyHeightChanged={setMainHeight}
                />
              )}
              {ui === UI.arg && <Input key="AppInput" />}

              {hint && <Hint key="AppHint" />}
              {logHtml?.length > 0 && script?.log !== 'false' && (
                <Log key="AppLog" />
              )}

              {(showTabs || showSelected) && (
                <div className="max-h-5.5">
                  {showTabs && <Tabs key="AppTabs" />}
                  {showSelected && <Selected key="AppSelected" />}
                </div>
              )}
            </header>
            <main
              ref={mainRef}
              className={`
            flex
        flex-1

        w-full max-h-full h-full
        `}
              onPaste={onPaste}
              onDrop={(event) => {
                console.log(`???? drop`);
                onDrop(event);
              }}
              onDragEnter={() => {
                console.log(`drag enter`);
              }}
              onDragOver={(event) => {
                event.stopPropagation();
                event.preventDefault();
              }}
            >
              <AnimatePresence key="mainComponents">
                {ui === UI.splash && <Splash />}
                {ui === UI.drop && <Drop />}
                {ui === UI.textarea && <TextArea />}
                {ui === UI.editor && <Editor />}
                {ui === UI.term && <Terminal />}
              </AnimatePresence>
              <AutoSizer>
                {({ width, height }) => (
                  <>
                    {(ui === UI.arg && !nullChoices && choices.length > 0 && (
                      <>
                        <List height={height} width={width} />
                      </>
                    )) ||
                      (!!(ui === UI.arg || ui === UI.hotkey || ui === UI.div) &&
                        panelHTML.length > 0 && (
                          <>
                            <Panel width={width} height={height} />
                          </>
                        )) ||
                      (ui === UI.form && (
                        <>
                          <Form width={width} height={height} />
                        </>
                      ))}
                  </>
                )}
              </AutoSizer>
            </main>

            <ActionBar />
          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
