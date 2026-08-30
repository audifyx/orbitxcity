import { useEffect } from "react";

import {
  openExportInBrowser,
  type ExportPageStatus,
} from "../lib/exportWallet";

export type ExportKeySheetProps = {
  visible: boolean;
  address: string;
  onClose: () => void;
  onResult: (status: ExportPageStatus, error?: string) => void;
};

export function ExportKeySheet({
  visible,
  address,
  onClose,
  onResult,
}: ExportKeySheetProps) {
  useEffect(() => {
    if (!visible) {
      return;
    }
    void (async () => {
      try {
        await openExportInBrowser(address);
        onResult("closed");
      } catch (error) {
        onResult(
          "error",
          error instanceof Error
            ? error.message
            : "Could not open the Privy export page.",
        );
      } finally {
        onClose();
      }
    })();
  }, [address, onClose, onResult, visible]);

  return null;
}
