import TransferBrandMotif, { type TransferBrandMotifProps } from "./TransferBrandMotif";

/** Compatibility for older callers; every transfer now uses the same circular logo. */
export function TransferJourneyVisual(props: Omit<TransferBrandMotifProps, "locale"> & { locale?: TransferBrandMotifProps["locale"] }) {
  return <TransferBrandMotif {...props} locale={props.locale ?? "en"} />;
}
