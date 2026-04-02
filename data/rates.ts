export const currentRates = {
  sellAUD: 71250, // فروش دلار استرالیا (مبلغی که صرافی می‌فروشد)
  buyAUD: 70800,  // خرید دلار استرالیا (مبلغی که صرافی از شما می‌خرد)
};

export const chartData = {
  daily: [
    { time: "شنبه", rate: 70500 },
    { time: "یکشنبه", rate: 71200 },
    { time: "دوشنبه", rate: 70850 },
    { time: "سه‌شنبه", rate: 71800 },
    { time: "چهارشنبه", rate: 72150 },
    { time: "پنج‌شنبه", rate: 71650 },
    { time: "جمعه", rate: currentRates.sellAUD }, // متصل به قیمت امروز
  ],
  monthly: [
    { time: "فروردین", rate: 68000 },
    { time: "اردیبهشت", rate: 69500 },
    { time: "خرداد", rate: 70200 },
    { time: "تیر", rate: 69800 },
    { time: "مرداد", rate: 71000 },
    { time: "شهریور", rate: currentRates.sellAUD },
  ],
  yearly: [
    { time: "۲۰۲۱", rate: 58000 },
    { time: "۲۰۲۲", rate: 61000 },
    { time: "۲۰۲۳", rate: 65000 },
    { time: "۲۰۲۴", rate: 68500 },
    { time: "۲۰۲۵", rate: 70000 },
    { time: "۲۰۲۶", rate: currentRates.sellAUD },
  ]
};