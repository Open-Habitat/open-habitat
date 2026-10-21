import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorSplit } from "./EditorSplit";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("leaves height following to the conversation but anchors content-width reflow", () => {
  let resize: ResizeObserverCallback = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  let rowTop = 20;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.matches("p") ? rowTop : 0;
      return { top, bottom: top + 100, width: 440, height: 100 } as DOMRect;
    },
  );
  const view = render(
    <EditorSplit
      open={false}
      collapsed={false}
      width={440}
      min={300}
      max={640}
      editor={null}
      strip={{ label: "Keskustelu", working: false, unread: false }}
      onResize={() => {}}
      onCollapse={() => {}}
      onReset={() => {}}
      onShowConversation={() => {}}
    >
      <section className="ah-conversation-stream">
        <p>Reading anchor</p>
      </section>
    </EditorSplit>,
  );
  const stream = view.getByText("Reading anchor").parentElement;
  if (!stream) throw new Error("Missing conversation stream");
  Object.defineProperties(stream, {
    scrollHeight: { value: 1000 },
    clientHeight: { value: 400 },
  });
  stream.scrollTop = 100;
  fireEvent.scroll(stream);
  const notify = (width: number, height: number) =>
    act(() => {
      resize(
        [
          {
            target: stream,
            contentRect: {
              width,
              height,
              x: 0,
              y: 0,
              top: 0,
              left: 0,
              right: width,
              bottom: height,
              toJSON: () => ({}),
            },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        {} as ResizeObserver,
      );
    });
  notify(392, 400);
  // A footer change must not restore a stale anchor over native following.
  rowTop = 50;
  notify(392, 368);
  expect(stream.scrollTop).toBe(100);
  // Padding can change the text width while the border box remains 440px.
  rowTop = 80;
  notify(412, 368);
  expect(stream.scrollTop).toBe(130);
  view.unmount();
});
