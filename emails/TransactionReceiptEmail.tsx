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
  paymentLink?: string | null;
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
    <td style="padding:9px 0;border-top:1px solid #f1f5f9;color:#64748b;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;width:38%;vertical-align:top;">${esc(label)}</td>
    <td style="padding:9px 0;border-top:1px solid #f1f5f9;color:#1e293b;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:500;vertical-align:top;text-align:right;">${esc(value)}</td>
  </tr>`;
}

// ─── Main render function ─────────────────────────────────────────────────────

export function renderTransactionReceiptHtml(props: TransactionReceiptProps): string {
  const {
    referenceId, transactionDate,
    senderFullName, senderPhone, senderAddress,
    receiverFullName, receiverPhone, receiverAddress, receiverBankDetail,
    amountSent, amountReceived,
    promoCode, sourceOfFunds, paymentLink,
  } = props;

  const dateStr = esc(formatDate(transactionDate));
  const ref     = esc(String(referenceId));
  const F       = `'Inter','Helvetica Neue',Helvetica,Arial,sans-serif`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Transaction Receipt — Zarman Exchange</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>:root{color-scheme:light;}body{margin:0;padding:0;background:#e8edf4;}</style>
</head>
<body style="margin:0;padding:0;background:#e8edf4;font-family:${F};-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#e8edf4;padding:40px 16px 56px;">
<tr><td align="center">

<!-- ════════════════════ CARD ════════════════════ -->
<table width="600" cellpadding="0" cellspacing="0" role="presentation"
       style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;
              box-shadow:0 4px 24px rgba(15,23,42,0.10),0 1px 4px rgba(15,23,42,0.06);">

  <!-- ▌HEADER ▐ -->
  <tr>
    <td bgcolor="#08111f" style="background:#08111f;padding:36px 44px 30px;text-align:center;">
      <img src="https://zarman.com.au/images/logo-no-text-light.svg" alt="Zarman Exchange"
           width="52" height="52" style="display:block;margin:0 auto 14px;width:52px;height:52px;border:0;"/>
      <div style="color:#ffffff;font-family:${F};font-size:20px;font-weight:700;
                  letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">Zarman Exchange</div>
      <div style="color:#7c8fa8;font-family:${F};font-size:12px;font-weight:400;
                  line-height:1.6;margin-bottom:14px;">+61 497 851 631&nbsp;&nbsp;&middot;&nbsp;&nbsp;@zarmanex</div>
      <a href="https://zarman.com.au"
         style="display:inline-block;color:#93c5fd;font-family:${F};font-size:12px;
                font-weight:500;text-decoration:none;border:1px solid #550cdb;
                border-radius:20px;padding:4px 16px;letter-spacing:0.03em;">zarman.com.au</a>
    </td>
  </tr>

  <!-- ▌SUCCESS BANNER ▐ -->
  <tr>
    <td bgcolor="#059669" style="background:#059669;padding:13px 44px;text-align:center;">
      <span style="color:#ffffff;font-family:${F};font-size:14px;font-weight:600;letter-spacing:0.03em;">&#10003;&nbsp;&nbsp;Transaction Successful</span>
    </td>
  </tr>

  <!-- ▌TAGLINE ▐ -->
  <tr>
    <td bgcolor="#f8fafc" style="background:#f8fafc;padding:15px 44px;text-align:center;border-bottom:1px solid #e2e8f0;">
      <span style="color:#64748b;font-family:${F};font-size:12px;font-style:italic;font-weight:400;">From Uluru to Damavand &mdash; Just in a few hours</span>
    </td>
  </tr>

  <!-- ▌DATE / REFERENCE ▐ -->
  <tr>
    <td style="padding:0;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:18px 44px;width:50%;border-right:1px solid #e2e8f0;vertical-align:top;">
            <div style="color:#94a3b8;font-family:${F};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:5px;">Date</div>
            <div style="color:#0f172a;font-family:${F};font-size:13px;font-weight:500;">${dateStr}</div>
          </td>
          <td style="padding:18px 44px;width:50%;vertical-align:top;">
            <div style="color:#94a3b8;font-family:${F};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:5px;">Reference</div>
            <div style="color:#0f172a;font-family:${F};font-size:13px;font-weight:600;word-break:break-all;">#${ref}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ▌AMOUNT ROW ▐ -->
  <tr>
    <td style="padding:20px 28px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border-radius:12px;overflow:hidden;border:1.5px solid #e2e8f0;border-top:3px solid #2563eb;">
        <tr>
          <!-- Sent -->
          <td bgcolor="#ffffff"
              style="background:#ffffff;padding:22px 26px;width:46%;vertical-align:middle;">
            <div style="color:#94a3b8;font-family:${F};font-size:10px;font-weight:700;
                        letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">Amount Sent</div>
            <div style="color:#0f172a;font-family:${F};font-size:22px;font-weight:800;
                        line-height:1.2;">${esc(amountSent).replace(/تومان/g, 'IRT')}</div>
          </td>
          <!-- Divider + Arrow -->
          <td bgcolor="#f8fafc"
              style="background:#f8fafc;width:8%;text-align:center;vertical-align:middle;
                     border-left:1.5px solid #e2e8f0;border-right:1.5px solid #e2e8f0;">
            <span style="color:#cbd5e1;font-family:${F};font-size:20px;font-weight:300;">&#8594;</span>
          </td>
          <!-- Received -->
          <td bgcolor="#f0fdf4"
              style="background:#f0fdf4;padding:22px 26px;width:46%;vertical-align:middle;
                     text-align:right;">
            <div style="color:#059669;font-family:${F};font-size:10px;font-weight:700;
                        letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">Amount Received</div>
            <div style="color:#047857;font-family:${F};font-size:22px;font-weight:800;
                        line-height:1.2;">${esc(amountReceived).replace(/تومان/g, 'IRT')}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ▌SENDER DETAILS ▐ -->
  <tr>
    <td style="padding:4px 28px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <tr>
          <td bgcolor="#f8fafc" style="background:#f8fafc;padding:11px 20px;border-bottom:1px solid #e2e8f0;">
            <span style="color:#475569;font-family:${F};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Sender Details</span>
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:16px 20px 16px;">
            <div style="color:#0f172a;font-family:${F};font-size:15px;font-weight:700;margin-bottom:12px;">${esc(senderFullName || "—")}</div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${detailRow("Phone", senderPhone)}
              ${detailRow("Address", senderAddress)}
              ${detailRow("Loyalty Discount", promoCode)}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ▌RECEIVER DETAILS ▐ -->
  <tr>
    <td style="padding:4px 28px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <tr>
          <td bgcolor="#f8fafc" style="background:#f8fafc;padding:11px 20px;border-bottom:1px solid #e2e8f0;">
            <span style="color:#475569;font-family:${F};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Receiver Details</span>
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:16px 20px 16px;">
            <div style="color:#0f172a;font-family:${F};font-size:15px;font-weight:700;margin-bottom:12px;">${esc(receiverFullName || "—")}</div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${detailRow("Phone", receiverPhone)}
              ${detailRow("Address", receiverAddress)}
              ${paymentLink ? `<tr>
    <td style="padding:9px 0;border-top:1px solid #f1f5f9;color:#64748b;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;width:38%;vertical-align:top;">Payment Link</td>
    <td style="padding:9px 0;border-top:1px solid #f1f5f9;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:500;vertical-align:top;text-align:right;"><a href="${esc(paymentLink)}" style="color:#2563eb;word-break:break-all;">${esc(paymentLink)}</a></td>
  </tr>` : ""}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ▌NOTICE ▐ -->
  <tr>
    <td style="padding:0 28px 24px;text-align:center;">
      <p style="color:#94a3b8;font-family:${F};font-size:12px;line-height:1.7;margin:0;">
        Your transaction was reported to the AUSTRAC and is known to them with the above Reference code. Please keep it for your records.<br/>
        Questions?&nbsp;
        <a href="mailto:info@zarman.com.au" style="color:#3b82f6;text-decoration:none;font-weight:500;">info@zarman.com.au</a>
        &nbsp;&middot;&nbsp;
        <a href="tel:+61497851631" style="color:#3b82f6;text-decoration:none;font-weight:500;">+61 497 851 631</a>
      </p>
    </td>
  </tr>

  <!-- ▌FOOTER ▐ -->
  <tr>
    <td bgcolor="#0f172a" style="background:#0f172a;padding:22px 44px;text-align:center;border-top:3px solid #2563eb;">
      <div style="color:#94a3b8;font-family:${F};font-size:10px;font-weight:400;line-height:2;letter-spacing:0.04em;">
        ABN: 70 692 742 957&nbsp;&nbsp;|&nbsp;&nbsp;ACN: 692 742 957&nbsp;&nbsp;|&nbsp;&nbsp;AUSTRAC: ND100907570<br/>
        Zarman Exchange Pty Ltd.
      </div>
    </td>
  </tr>

</table>
<!-- ═════════════════════════════════════════════════════════ -->

</td></tr>
</table>

</body>
</html>`;
}
