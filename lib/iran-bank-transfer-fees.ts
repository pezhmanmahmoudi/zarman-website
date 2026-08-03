export type IranBankTransferMethod = "free" | "pol" | "paya" | "satna";

export type IranBankTransferMethodOption = {
  value: IranBankTransferMethod;
  labelFA: string;
  labelEN: string;
  descriptionFA: string;
  maxAmountToman: number | null;
  feeRate: number;
  feeCapToman: number | null;
};

export const IRAN_BANK_TRANSFER_METHOD_OPTIONS: IranBankTransferMethodOption[] = [
  {
    value: "free",
    labelFA: "انتقال رایگان",
    labelEN: "Free Transfer",
    descriptionFA: "بدون کارمزد",
    maxAmountToman: null,
    feeRate: 0,
    feeCapToman: 0,
  },
  {
    value: "pol",
    labelFA: "پل",
    labelEN: "Pol",
    descriptionFA: "فقط تا ۵۰,۰۰۰,۰۰۰ تومان",
    maxAmountToman: 50_000_000,
    feeRate: 0.0002,
    feeCapToman: null,
  },
  {
    value: "paya",
    labelFA: "پایا",
    labelEN: "Paya",
    descriptionFA: "فقط تا ۲۰۰,۰۰۰,۰۰۰ تومان",
    maxAmountToman: 200_000_000,
    feeRate: 0.0001,
    feeCapToman: 7_500,
  },
  {
    value: "satna",
    labelFA: "ساتنا",
    labelEN: "Satna",
    descriptionFA: "بدون سقف مبلغ",
    maxAmountToman: null,
    feeRate: 0.0002,
    feeCapToman: 35_000,
  },
];

const OPTION_BY_METHOD = new Map(IRAN_BANK_TRANSFER_METHOD_OPTIONS.map((option) => [option.value, option]));

export function getIranBankTransferMethodOption(method: IranBankTransferMethod) {
  return OPTION_BY_METHOD.get(method) ?? null;
}

export function getIranBankTransferFeeError(amountToman: number, method: IranBankTransferMethod): string | null {
  const option = getIranBankTransferMethodOption(method);
  if (!option) return "روش انتقال انتخاب‌شده معتبر نیست.";
  if (amountToman <= 0) return "مبلغ انتقال نامعتبر است.";
  if (option.maxAmountToman !== null && amountToman > option.maxAmountToman) {
    if (method === "pol") return "پل فقط برای مبالغ تا ۵۰,۰۰۰,۰۰۰ تومان قابل استفاده است.";
    if (method === "paya") return "پایا فقط برای مبالغ تا ۲۰۰,۰۰۰,۰۰۰ تومان قابل استفاده است.";
  }
  return null;
}

export function calcIranBankTransferFee(amountToman: number, method: IranBankTransferMethod): number {
  const option = getIranBankTransferMethodOption(method);
  if (!option || amountToman <= 0) return 0;
  if (option.maxAmountToman !== null && amountToman > option.maxAmountToman) return 0;
  if (option.value === "free") return 0;

  const rawFee = Math.round(amountToman * option.feeRate);
  return option.feeCapToman === null ? rawFee : Math.min(rawFee, option.feeCapToman);
}

export function formatIranBankTransferFee(amountToman: number, method: IranBankTransferMethod): string {
  return calcIranBankTransferFee(amountToman, method).toLocaleString("en-US");
}