"use client";

import React, { useState, useTransition } from "react";
import { 
  Save, CheckCircle, AlertTriangle, TrendingUp, Power, 
  CalendarClock, Settings2, Percent, Banknote 
} from "lucide-react";
import formStyles from "@/styles/admin/AdminForms.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { updateSystemSettings } from "@/app/actions/admin.actions";

type SystemSettings = {
  buy_rate: number | null;
  sell_rate: number | null;
  market_active: boolean;
  pause_message: string | null;
  rate_source?: string | null;
  rate_note?: string | null;
  rate_date?: string | null;
  discount_step_volume: number;
  discount_percent_per_step: number;
  max_discount_percent: number;
  fee_threshold: number;
  applied_fee: number;
};

export function SystemSettingsForm({
  initialSettings,
}: {
  initialSettings: SystemSettings;
}) {
  // Rates & Market States
  const [buyRate, setBuyRate] = useState(initialSettings.buy_rate ? String(initialSettings.buy_rate) : "");
  const [sellRate, setSellRate] = useState(initialSettings.sell_rate ? String(initialSettings.sell_rate) : "");
  const [marketActive, setMarketActive] = useState(initialSettings.market_active);
  const [pauseMessage, setPauseMessage] = useState(initialSettings.pause_message ?? "");
  const [note, setNote] = useState(initialSettings.rate_note ?? "");

  // Financial Config States
  const [discountStepVolume, setDiscountStepVolume] = useState(String(initialSettings.discount_step_volume ?? 1000));
  const [discountPercentPerStep, setDiscountPercentPerStep] = useState(String(initialSettings.discount_percent_per_step ?? 0.005));
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(String(initialSettings.max_discount_percent ?? 0.25));
  const [feeThreshold, setFeeThreshold] = useState(String(initialSettings.fee_threshold ?? 1000));
  const [appliedFee, setAppliedFee] = useState(String(initialSettings.applied_fee ?? 30));

  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const handleSave = () => {
    const parsedBuy = buyRate.trim() ? parseFloat(buyRate) : null;
    const parsedSell = sellRate.trim() ? parseFloat(sellRate) : null;
    const parsedDiscountStep = parseFloat(discountStepVolume);
    const parsedDiscountPercent = parseFloat(discountPercentPerStep);
    const parsedMaxDiscount = parseFloat(maxDiscountPercent);
    const parsedFeeThreshold = parseFloat(feeThreshold);
    const parsedAppliedFee = parseFloat(appliedFee);

    if (parsedBuy !== null && (isNaN(parsedBuy) || parsedBuy <= 0)) {
      setSaveError("Buy rate must be a positive number.");
      setSaveStatus("error"); return;
    }
    if (!marketActive && !pauseMessage.trim()) {
      setSaveError("Please enter a pause message when market is inactive.");
      setSaveStatus("error"); return;
    }
    if (isNaN(parsedDiscountStep) || isNaN(parsedAppliedFee)) {
      setSaveError("Financial fields must be valid numbers.");
      setSaveStatus("error"); return;
    }

    setSaveStatus("idle");
    startTransition(async () => {
      const result = await updateSystemSettings({
        buyRate: parsedBuy,
        sellRate: parsedSell,
        marketActive,
        pauseMessage,
        note,
        financeConfig: {
          discount_step_volume: parsedDiscountStep,
          discount_percent_per_step: parsedDiscountPercent,
          max_discount_percent: parsedMaxDiscount,
          fee_threshold: parsedFeeThreshold,
          applied_fee: parsedAppliedFee
        }
      });
      if (result.error) {
        setSaveError(result.error);
        setSaveStatus("error");
      } else {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 4000);
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingTop: "0.5rem" }}>
      
      {/* ── 2-Column Grid Layout for Desktop ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.25rem" }}>
        
        {/* === Left Column: Rates & Market Status === */}
        <div className={cardStyles.panel} style={{ display: "flex", flexDirection: "column" }}>
          <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderTight}`}>
            <div className={formStyles.actionBarMeta}>
              <div>
                <h3 className={`${cardStyles.panelTitle} ${cardStyles.panelTitleAccent}`}>
                  <TrendingUp size={18} />
                  Rates & Market Status
                </h3>
              </div>
              {initialSettings.rate_date && (
                <div className={formStyles.infoPill} style={{ marginTop: '0.5rem' }}>
                  <CalendarClock size={12} />
                  Last update: <span className={formStyles.infoPillValue}>{initialSettings.rate_date}</span>
                </div>
              )}
            </div>
          </div>

          <div className={cardStyles.panelBody} style={{ flex: 1 }}>
            {/* Daily Rates */}
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={`${formStyles.label} ${formStyles.labelInfo}`}>Buy Rate (Toman)</label>
                <div className={formStyles.relative}>
                  <span className={formStyles.currencyPrefix}>$</span>
                  <input type="number" className={`${formStyles.input} ${formStyles.inputCurrency}`} value={buyRate} onChange={(e) => setBuyRate(e.target.value)} />
                </div>
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={`${formStyles.label} ${formStyles.labelSuccess}`}>Sell Rate (Toman)</label>
                <div className={formStyles.relative}>
                  <span className={formStyles.currencyPrefix}>$</span>
                  <input type="number" className={`${formStyles.input} ${formStyles.inputCurrency}`} value={sellRate} onChange={(e) => setSellRate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className={formStyles.divider} style={{ margin: "1.25rem 0" }}></div>

            {/* Market Availability */}
            <div className={`${formStyles.toggleRow} ${!marketActive ? formStyles.toggleRowDanger : ""}`} style={{ padding: "0.75rem 1rem" }}>
              <div className={formStyles.toggleInfo}>
                <span className={formStyles.toggleLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Power size={14} color={marketActive ? "var(--success)" : "var(--danger)"} />
                  {marketActive ? "Market is Active" : "Market is Suspended"}
                </span>
                <span className={formStyles.toggleDesc}>{marketActive ? "Accepting transactions." : "Transactions are paused."}</span>
              </div>
              <label className={formStyles.switch}>
                <input type="checkbox" className={formStyles.switchInput} checked={marketActive} onChange={(e) => setMarketActive(e.target.checked)} />
                <span className={formStyles.switchSlider} />
              </label>
            </div>

            {!marketActive && (
              <div className={`${formStyles.fieldGroup} ${formStyles.fieldFadeIn}`} style={{marginTop: '1rem'}}>
                <label className={`${formStyles.label} ${formStyles.labelDanger}`}>Customer-Facing Pause Message</label>
                <textarea className={`${formStyles.textarea} ${formStyles.textareaDanger}`} style={{ minHeight: "80px" }} value={pauseMessage} onChange={(e) => setPauseMessage(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* === Right Column: Financial Rules & Fees === */}
        <div className={cardStyles.panel} style={{ display: "flex", flexDirection: "column" }}>
          <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderTight}`}>
            <div>
              <h3 className={`${cardStyles.panelTitle} ${cardStyles.panelTitleAccent}`}>
                <Settings2 size={18} />
                Financial Rules & Fees
              </h3>
            </div>
          </div>
          
          <div className={cardStyles.panelBody} style={{ flex: 1 }}>
            {/* Transfer Fees */}
            <div className={cardStyles.sectionHeaderTight}>
              <h4 className={formStyles.formSectionTitle}><Banknote size={14} style={{display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom'}}/> Transfer Fees</h4>
            </div>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Fee Threshold (AUD)</label>
                <div className={formStyles.relative}>
                  <span className={formStyles.currencyPrefix}>$</span>
                  <input type="number" step="100" className={`${formStyles.input} ${formStyles.inputCurrency}`} value={feeThreshold} onChange={(e) => setFeeThreshold(e.target.value)} />
                </div>
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Applied Fee (AUD)</label>
                <div className={formStyles.relative}>
                  <span className={formStyles.currencyPrefix}>$</span>
                  <input type="number" step="1" className={`${formStyles.input} ${formStyles.inputCurrency}`} value={appliedFee} onChange={(e) => setAppliedFee(e.target.value)} />
                </div>
              </div>
            </div>

            <div className={formStyles.divider} style={{ margin: "1.25rem 0" }}></div>

            {/* Loyalty Discount */}
            <div className={cardStyles.sectionHeaderTight}>
              <h4 className={formStyles.formSectionTitle}><Percent size={14} style={{display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom'}}/> Loyalty Discount Logic</h4>
            </div>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Step Volume</label>
                <input type="number" step="500" className={formStyles.input} value={discountStepVolume} onChange={(e) => setDiscountStepVolume(e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>% Per Step</label>
                <input type="number" step="0.001" className={formStyles.input} value={discountPercentPerStep} onChange={(e) => setDiscountPercentPerStep(e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Max Discount %</label>
                <input type="number" step="0.01" className={formStyles.input} value={maxDiscountPercent} onChange={(e) => setMaxDiscountPercent(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className={formStyles.actionBar} style={{ padding: "1rem 1.5rem" }}>
        <div className={formStyles.actionBarMeta}>
          {saveStatus === "success" && <span className={`${formStyles.saveStatus} ${formStyles.saveStatusSuccess} ${formStyles.saveStatusStrong}`}><CheckCircle size={18} /> Live.</span>}
          {saveStatus === "error" && <span className={`${formStyles.saveStatus} ${formStyles.saveStatusError} ${formStyles.saveStatusStrong}`}><AlertTriangle size={18} /> {saveError}</span>}
          {saveStatus === "idle" && <span className={formStyles.saveHint}>Ready to apply changes.</span>}
        </div>
        <button type="button" className={`${formStyles.btnPrimary} ${formStyles.btnPrimaryWide}`} onClick={handleSave} disabled={isPending}>
          <Save size={18} /> {isPending ? "Applying..." : "Save Settings"}
        </button>
      </div>
      
    </div>
  );
}