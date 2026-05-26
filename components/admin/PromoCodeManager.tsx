// Pure TypeScript HTML template — no React Email dependency needed.
// Resend accepts a plain HTML string directly.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionReceiptProps {
  referenceId: string | number;
  transactionDate: string;

  senderFullName: string;
  senderPhone: string;
  senderAddress: string;

  receiverFullName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverBankDetail?: string;

  amountSent: string;
  amountReceived: string;

  promoCode?: string | null;
  sourceOfFunds?: string | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** One label/value row inside a details card. Returns empty string if value is falsy. */
function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:10px 0 0 0;color:#94A3B8;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.04em;width:35%;vertical-align:top;">[${esc(label)}]</td>
    <td style="padding:10px 0 0 0;color:#F8FAFC;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:500;vertical-align:top;">${esc(value)}</td>
  </tr>`;
}

// ─── Main render function ─────────────────────────────────────────────────────

export function renderTransactionReceiptHtml(props: TransactionReceiptProps): string {
  const {
    referenceId, transactionDate,
    senderFullName, senderPhone, senderAddress,
    receiverFullName, receiverPhone, receiverAddress, receiverBankDetail,
    amountSent, amountReceived,
    promoCode, sourceOfFunds,
  } = props;

  const dateStr = esc(formatDate(transactionDate));
  const ref     = esc(String(referenceId));
  const F       = `'Inter','Helvetica Neue',Helvetica,Arial,sans-serif`;

  // Colors based on premium fintech dark theme
  const bgBody = "#F0F2F5";
  const bgCardOuter = "#0B0E14";
  const bgCardInner = "#111620";
  const bgDetailsCard = "#1A2235";
  const textPrimary = "#FFFFFF";
  const textSecondary = "#94A3B8";
  const accentBlue = "#2563EB";
  const successGreen = "#10B981";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>Transaction Receipt — Zarman Exchange</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>:root{color-scheme:light dark;}body{margin:0;padding:0;background:${bgBody};}</style>
</head>
<body style="margin:0;padding:0;background:${bgBody};font-family:${F};-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${bgBody};padding:40px 16px 56px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" role="presentation"
       style="max-width:600px;width:100%;background:${bgCardOuter};border-radius:24px;overflow:hidden;
              box-shadow:0 10px 40px rgba(0,0,0,0.15);">

  <tr>
    <td style="padding:40px 44px 30px;text-align:center;">
      <img src="https://zarman.com.au/images/logo-no-text-light.svg" alt="Zarman Exchange"
           width="64" height="64" style="display:block;margin:0 auto 16px;width:64px;height:64px;border:0;"/>
      <div style="color:${textPrimary};font-family:${F};font-size:22px;font-weight:800;
                  letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">Zarman Exchange</div>
      <div style="color:${textSecondary};font-family:${F};font-size:10px;font-weight:500;
                  letter-spacing:0.05em;margin-bottom:24px;">ABN: 70 692 742 957 &nbsp;|&nbsp; ACN: 692 742 957 &nbsp;|&nbsp; AUSTRAC: ND100907570</div>
      
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
        <tr>
          <td style="border: 2px solid ${successGreen}; border-radius: 30px; padding: 12px 24px; text-align: center;">
            <div style="color:${successGreen};font-family:${F};font-size:10px;font-weight:600;letter-spacing:0.05em;margin-bottom:4px;">Receipt for</div>
            <div style="color:${successGreen};font-family:${F};font-size:18px;font-weight:700;">&#10003;&nbsp;Transaction Successful</div>
          </td>
        </tr>
      </table>
      
      <div style="color:${textSecondary};font-family:${F};font-size:12px;font-weight:500;margin-top:16px;">
        Date: ${dateStr} &nbsp;|&nbsp; Reference: #${ref}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:0 44px 32px;text-align:center;">
      <div style="color:${textPrimary};font-family:${F};font-size:16px;font-weight:500;letter-spacing:0.02em;">From Uluru to Damavand</div>
      <div style="color:${textSecondary};font-family:${F};font-size:12px;font-weight:400;margin-top:4px;">Just in a few hours</div>
    </td>
  </tr>

  <tr>
    <td bgcolor="${bgCardInner}" style="background:${bgCardInner};padding:40px 44px;">
      
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid ${accentBlue};border-radius:16px;background:${bgDetailsCard};margin-bottom:24px;">
        <tr>
          <td style="padding:24px;">
            <div style="color:${accentBlue};font-family:${F};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;">Sender Details</div>
            
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="color:${textPrimary};font-family:${F};font-size:14px;font-weight:700;padding-bottom:12px;text-decoration:underline;">[${esc(senderFullName || "—")}]</td></tr>
                    <tr><td style="color:${textPrimary};font-family:${F};font-size:14px;font-weight:500;padding-bottom:8px;">[${esc(senderPhone)}]</td></tr>
                    <tr><td style="color:${textPrimary};font-family:${F};font-size:14px;font-weight:500;">[${esc(senderAddress)}]</td></tr>
                  </table>
                </td>
                <td style="width:50%;vertical-align:middle;text-align:right;border-left:1px solid rgba(255,255,255,0.1);padding-left:24px;">
                   <div style="color:${textSecondary};font-family:${F};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Amount Sent</div>
                   <div style="color:#D946EF;font-family:${F};font-size:24px;font-weight:800;letter-spacing:0.02em;">[${esc(amountSent).replace(/تومان/g, 'IRT')}]</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
        <tr><td align="center"><div style="height:24px;border-left:1px dashed ${accentBlue};width:1px;margin-top:-24px;"></div></td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid ${accentBlue};border-radius:16px;background:${bgDetailsCard};">
        <tr>
          <td style="padding:24px;">
            <div style="color:${accentBlue};font-family:${F};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;">Receiver Details</div>
            
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="color:${textPrimary};font-family:${F};font-size:14px;font-weight:700;padding-bottom:12px;text-decoration:underline;">[${esc(receiverFullName || "—")}]</td></tr>
                    <tr><td style="color:${textPrimary};font-family:${F};font-size:14px;font-weight:500;padding-bottom:8px;">[${esc(receiverPhone)}]</td></tr>
                    <tr><td style="color:${textPrimary};font-family:${F};font-size:14px;font-weight:500;">[${esc(receiverAddress)}]</td></tr>
                  </table>
                </td>
                <td style="width:50%;vertical-align:middle;text-align:right;border-left:1px solid rgba(255,255,255,0.1);padding-left:24px;">
                   <div style="color:${textSecondary};font-family:${F};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Amount Received</div>
                   <div style="color:#D946EF;font-family:${F};font-size:24px;font-weight:800;letter-spacing:0.02em;">[${esc(amountReceived).replace(/تومان/g, 'IRT')}]</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <tr>
    <td bgcolor="${bgCardInner}" style="background:${bgCardInner};padding:0 44px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;">
        <tr>
          <td style="color:${textPrimary};font-family:${F};font-size:12px;font-weight:500;width:50%;">
            &#127760;&nbsp;&nbsp;www.zarman.com.au
          </td>
          <td style="color:${textPrimary};font-family:${F};font-size:12px;font-weight:500;width:50%;text-align:right;">
            &#128222;&nbsp;&nbsp;+61 497 851 631
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}