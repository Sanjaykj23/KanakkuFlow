import { redirect } from "next/navigation";

export default function BillingPaymentsRedirect() {
  redirect("/finance/payments");
}
