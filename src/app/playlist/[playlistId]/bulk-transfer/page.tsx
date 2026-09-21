import type { Metadata } from "next";
import BulkTransferPage from "./bulk-transfer-page";

export const metadata: Metadata = {
  title: "Bulk transfer",
};

export default function Page() {
  return <BulkTransferPage />;
}
