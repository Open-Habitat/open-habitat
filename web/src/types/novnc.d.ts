// The part of noVNC's RFB class the browser viewer uses (noVNC ships no
// TypeScript types).
declare module "@novnc/novnc" {
  export default class RFB extends EventTarget {
    constructor(
      target: HTMLElement,
      urlOrChannel: string | WebSocket,
      options?: { shared?: boolean; wsProtocols?: string[] },
    );
    viewOnly: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    clipViewport: boolean;
    focusOnClick: boolean;
    background: string;
    disconnect(): void;
    focus(): void;
  }
}
