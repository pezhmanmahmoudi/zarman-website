import { calcAppliedFee, type FinanceConfig } from "@/lib/pricing";

export type AmountCurrency = "AUD" | "IRT";
const SCALE = BigInt(1_000_000);
const round = (numerator: bigint, denominator: bigint) => (numerator + denominator / BigInt(2)) / denominator;
const cents = (value: number) => BigInt(Math.round(value * 100));

/** Currency amounts round once, in integer minor units; the customer's chosen side stays fixed. */
export function calculateQuoteMoney({ amount, currency, rate, txType, config, priorityFeeAud = 0 }: {
  amount: number; currency: AmountCurrency; rate: number; txType: "buy_aud" | "sell_aud";
  config: FinanceConfig; priorityFeeAud?: number;
}) {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100_000_000) throw Error("A valid exchange rate is required.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER / 100
    || (currency === "IRT" ? !Number.isSafeInteger(amount) : Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)) {
    throw Error("Enter a valid amount in the selected currency.");
  }
  const validFee = (value: number) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER / 100 && Math.abs(value * 100 - Math.round(value * 100)) <= 0.000001;
  if (!validFee(priorityFeeAud) || !validFee(config.applied_fee) || !Number.isFinite(config.fee_threshold) || config.fee_threshold < 0) throw Error("A valid fee configuration is required.");
  const rateUnits = BigInt(Math.round(rate * Number(SCALE)));
  if (rateUnits <= BigInt(0)) throw Error("A valid exchange rate is required.");
  const denominator = BigInt(100) * SCALE;
  const priorityCents = cents(priorityFeeAud);
  const priorityAmount = txType === "buy_aud" ? Number(round(priorityCents * rateUnits, denominator)) : Number(priorityCents) / 100;
  const convert = (raw: bigint, fee: bigint) => Number(round((raw + (txType === "buy_aud" ? fee : -fee)) * rateUnits, denominator));
  let rawCents: bigint;
  let fee: number;
  let equivalent: number;
  let adjustment = 0;
  if (currency === "AUD") {
    rawCents = cents(amount);
    fee = calcAppliedFee(amount, config);
    equivalent = convert(rawCents, cents(fee));
  } else {
    // A Toman input is the complete customer budget for buying AUD, or the exact
    // recipient target for selling AUD. Express fees are included in that budget.
    const target = amount - (txType === "buy_aud" ? priorityAmount : 0);
    if (target <= 0) throw Error("The amount must cover the service fees.");
    const netCents = round(BigInt(target) * denominator, rateUnits);
    if (netCents <= BigInt(0)) throw Error("The amount is below the currency rounding limit.");
    const candidates = [0, config.applied_fee].map(candidateFee => {
      const raw = netCents + (txType === "buy_aud" ? -cents(candidateFee) : cents(candidateFee));
      return { raw, fee: candidateFee };
    }).filter(candidate => candidate.raw > BigInt(0) && calcAppliedFee(Number(candidate.raw) / 100, config) === candidate.fee);
    // Prefer the fee-free candidate when both sides of a threshold are possible.
    const candidate = candidates[0];
    if (!candidate) throw Error("This Toman amount falls across the transfer-fee threshold. Adjust the amount or enter AUD.");
    rawCents = candidate.raw;
    fee = candidate.fee;
    equivalent = target;
    adjustment = target - convert(rawCents, cents(fee));
    if (Math.abs(adjustment) > Math.ceil(rate / 200) + 1) throw Error("The amount cannot be converted within currency rounding limits.");
  }
  const rawAmountAud = Number(rawCents) / 100;
  if ((txType === "sell_aud" && rawCents <= cents(fee)) || rawAmountAud <= 0 || equivalent <= 0 || !Number.isSafeInteger(equivalent)) throw Error("The amount must cover the service fees.");
  return { rawAmountAud, equivalentToman: equivalent, baseFeeAud: fee, priorityFeeAmount: priorityAmount,
    fundingTotal: txType === "buy_aud" ? equivalent + priorityAmount : Number(rawCents + priorityCents) / 100,
    recipientAmount: txType === "buy_aud" ? rawAmountAud : equivalent, roundingAdjustmentToman: adjustment };
}
