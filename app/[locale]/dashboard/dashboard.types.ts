export type Profile = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  phone_number?: string | null;
  telephone?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  birth_date?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  post_code?: string | null;
  country?: string | null;
  national_id?: string | null;
  passport_number?: string | null;
  kyc_status?: string | null;
  [key: string]: unknown;
};

export type Transaction = {
  id: string;
  user_id?: string;
  type: "buy_aud" | "sell_aud";
  amount_aud: number;
  equivalent_toman: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  recipient_id?: string | null;
  promo_code?: string | null;
  discount_amount?: number | null;
  loyalty_discount?: number | null;
  final_amount?: number | null;
  reference_code?: string | null;
  recipients?: Pick<Recipient, "id" | "label" | "full_name" | "account_name"> | null;
};

export type RecipientDirection = "aud" | "irt";
export type BankType = "bank_melli" | "other";

export type Recipient = {
  id: string;
  user_id: string;
  direction: RecipientDirection;
  label: string;
  // AUD fields
  bank_name?: string | null;
  bsb?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  residential_address?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  // IRT fields
  bank_type?: BankType | null;
  card_number?: string | null;
  shaba_number?: string | null;
  irt_account_number?: string | null;
  full_name?: string | null;
  irt_address?: string | null;
  irt_phone?: string | null;
  created_at?: string;
};

export type PromoCode = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  description: string | null;
  created_at: string;
};