import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Composer } from "./composer/Composer";
import { NoticeStack, NoticeStackProvider } from "./NoticeStack";
import { WarningBanner } from "./WarningBanner";

describe("conversation notices", () => {
  it("keeps a rejected stop separate from an uncertain send", () => {
    const noop = () => {};
    render(
      <NoticeStackProvider>
        <NoticeStack />
        <WarningBanner subject="send" data-testid="unknown" tone="neutral">
          unknown
        </WarningBanner>
        <Composer
          value=""
          activity="working"
          selectedWorkingMode="steer"
          onChange={noop}
          onSendNow={noop}
          onSteer={noop}
          onFollowUp={noop}
          onModeChange={noop}
          stopState="rejected"
          refusalSubject="send"
        />
      </NoticeStackProvider>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.getByTestId("composer-notice").getAttribute("data-tone"),
    ).toBe("danger");
    expect(
      screen.getByTestId("unknown").closest('[data-notice-subject="send"]'),
    ).not.toBeNull();
  });
  it("merges consequences into their subject, sorts severity, and keeps hidden actions out of view", () => {
    function View({ error = true }: { error?: boolean }) {
      return (
        <NoticeStackProvider>
          <NoticeStack />
          <WarningBanner subject="send" data-testid="send" tone="neutral">
            cause
          </WarningBanner>
          <WarningBanner subject="send" tone="neutral">
            consequence
          </WarningBanner>
          <WarningBanner subject="worker" data-testid="worker" tone="neutral">
            worker
          </WarningBanner>
          {error ? (
            <WarningBanner
              subject="attachment"
              data-testid="attachment"
              tone="danger"
            >
              refusal
            </WarningBanner>
          ) : null}
        </NoticeStackProvider>
      );
    }
    const view = render(<View />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByTestId("send").textContent).toContain("consequence");
    expect(screen.getByTestId("attachment").closest("[hidden]")).toBeNull();
    expect(screen.getByTestId("worker").closest("[hidden]")).not.toBeNull();
    fireEvent.click(screen.getByTestId("notice-stack-toggle"));
    expect(screen.getByTestId("worker").closest("[hidden]")).toBeNull();
    view.rerender(<View error={false} />);
    expect(screen.queryByTestId("attachment")).toBeNull();
    expect(screen.queryByTestId("notice-stack-toggle")).toBeNull();
    expect(screen.getByTestId("worker").closest("[hidden]")).toBeNull();
  });
});
