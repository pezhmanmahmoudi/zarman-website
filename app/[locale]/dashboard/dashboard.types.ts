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
};