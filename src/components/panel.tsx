/* eslint-disable no-nested-ternary */
import React, { LegacyRef, RefObject, useRef } from 'react';
import SimpleBar from 'simplebar-react';
import Highlight from 'react-highlight';
import { useAtom } from 'jotai';
import { mouseEnabledAtom, panelHTMLAtom } from '../jotai';
import {
  useEnter,
  useEscape,
  useKeyDirection,
  useObserveMainHeight,
  useOpen,
} from '../hooks';

interface PanelProps {
  width: number;
  height: number;
}

export default function Panel({ width, height }: PanelProps) {
  useEscape();
  useEnter();
  useOpen();
  const scrollRef: RefObject<any> = useRef(null);
  const [panelHTML] = useAtom(panelHTMLAtom);
  const [mouseEnabled] = useAtom(mouseEnabledAtom);

  const divRef = useObserveMainHeight<HTMLDivElement>();

  useKeyDirection((key) => {
    scrollRef.current.scrollBy({
      top: key === 'up' ? -200 : 200,
      behavior: 'smooth',
    });
  }, []);

  return (
    <SimpleBar
      scrollableNodeProps={{ ref: scrollRef }}
      style={
        {
          cursor: mouseEnabled ? 'auto' : 'none',
          width,
          height,
          WebkitAppRegion: 'no-drag',
          WebkitUserSelect: 'text',
        } as any
      }
    >
      <div className="w-full h-full" ref={divRef as LegacyRef<HTMLDivElement>}>
        <link />
        <Highlight innerHTML>{panelHTML}</Highlight>
      </div>
    </SimpleBar>
  );
}
