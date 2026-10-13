export type CompletedTransactionCorrection = {
  transactionId: string;
  requestId: string | null;
  revision: string;
  fundingCurrency: "AUD" | "IRT";
  recipientCurrency: "AUD" | "IRT";
  fundingTotal: number;
  recipientAmount: number;
  baseFeeAUD: number;
  priorityFee: number;
  payments: { id: string; amount: number; reference: string; accountName: string }[];
};

export type CorrectCompletedTransactionInput = {
  transactionId: string;
  revision: string;
  commandKey: string;
  fundingTotal: number;
  recipientAmount: number;
  reason: string;
  payments: { id: string; amount: number }[];
};
