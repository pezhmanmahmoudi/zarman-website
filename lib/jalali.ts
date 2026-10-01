// lib/jalali.ts
// Jalali (Shamsi) date helper — returns "YYYY/MM/DD" with zero-padded parts.
// Kept outside any "use server" module since it's a plain sync utility.
export function toJalaliStr(date: Date): string {
  const gy = date.getUTCFullYear(), gm = date.getUTCMonth() + 1, gd = date.getUTCDate();
  const gy1 = gy - 1600, gm1 = gm - 1, gd1 = gd - 1;
  let g_d_no = 365 * gy1 + Math.floor((gy1 + 3) / 4) - Math.floor((gy1 + 99) / 100) + Math.floor((gy1 + 399) / 400);
  const mDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) mDays[1] = 29;
  for (let i = 0; i < gm1; i++) g_d_no += mDays[i];
  g_d_no += gd1;
  let j_d_no = g_d_no - 79;
  const j_np = Math.floor(j_d_no / 12053); j_d_no %= 12053;
  let jy = 979 + 33 * j_np + 4 * Math.floor(j_d_no / 1461); j_d_no %= 1461;
  if (j_d_no >= 366) { jy += Math.floor((j_d_no - 1) / 365); j_d_no = (j_d_no - 1) % 365; }
  const jm2 = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let jm = 0;
  for (jm = 0; jm < 11 && j_d_no >= jm2[jm]; jm++) j_d_no -= jm2[jm];
  return `${jy}/${String(jm + 1).padStart(2, "0")}/${String(j_d_no + 1).padStart(2, "0")}`;
}
