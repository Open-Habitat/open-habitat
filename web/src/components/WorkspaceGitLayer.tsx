import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover,
} from "react-aria-components";
import { ControlButton } from "./ControlElements";

/** The chosen workspace layer: anchored on desktop, a modal sheet on phones. */
export function WorkspaceGitLayer({
  label,
  title,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [phone, setPhone] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 700px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const content = (
    <Dialog className="ah-dialog" aria-label={title}>
      <Heading slot="title" tabIndex={-1} ref={(node) => node?.focus()}>
        {title}
      </Heading>
      {children}
      <ControlButton size="page" variant="quiet" slot="close">
        Sulje
      </ControlButton>
    </Dialog>
  );
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) queueMicrotask(() => trigger.current?.focus());
      }}
    >
      <ControlButton
        size="row"
        presentation="pill"
        ref={trigger}
        variant="secondary"
      >
        {label}
      </ControlButton>
      {phone ? (
        <ModalOverlay className="ah-overlay ah-git-sheet" isDismissable>
          <Modal className="ah-modal">{content}</Modal>
        </ModalOverlay>
      ) : (
        <Popover placement="bottom start" className="ah-popover ah-git-layer">
          {content}
        </Popover>
      )}
    </DialogTrigger>
  );
}
