"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import styles from "./SelectBox.module.css";

export type OptionGroup = { label: string; options: string[] };
export type LabeledOption = { label: string; value: string };

export type SelectBoxProps = {
  options?: string[];
  labeledOptions?: LabeledOption[];
  groups?: OptionGroup[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dir?: "ltr" | "rtl";
  variant?: "default" | "ghost";
};

const DROPDOWN_MAX_HEIGHT = 260;
const DROPDOWN_GAP = 8;

export function SelectBox({
  options = [],
  labeledOptions,
  groups,
  value,
  onChange,
  placeholder = "انتخاب کنید...",
  disabled = false,
  className,
  dir = "rtl",
  variant = "default",
}: SelectBoxProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  // تشخیص سیستم‌عامل iOS برای استفاده از سلکتور نیتیو (Native)
  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }, []);

  // محاسبه هوشمند جهت باز شدن دراپ‌باکس (بالا یا پایین)
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP);
  }, [open]);

  // بستن دراپ‌باکس با کلیک بیرون از محوطه
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // اسکرول خودکار به گزینه انتخاب شده
  useEffect(() => {
    if (open && listRef.current && value) {
      const selected = listRef.current.querySelector("[data-selected='true']") as HTMLElement | null;
      selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [open, value]);

  const allOptions = groups
    ? groups.flatMap((g) => g.options)
    : labeledOptions
    ? labeledOptions.map((o) => o.value)
    : options;

  const displayLabel = labeledOptions
    ? (labeledOptions.find((o) => o.value === value)?.label ?? "")
    : value;

  const hasPersianChars = (text: string) => /[\u0600-\u06FF]/.test(text);
  const getTextAlignClass = (text: string) => (hasPersianChars(text) ? styles.textRtl : styles.textLtr);
  const normalizeGroupLabel = (label: string) => {
    if (dir === "rtl" && label === "Common") return "Common";
    if (dir === "rtl" && label === "All Countries") return "All Countries";
    return label;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    if (e.key === "Escape") setOpen(false);
    if (!open) return;
    const idx = allOptions.indexOf(value);
    if (e.key === "ArrowDown") { e.preventDefault(); onChange(allOptions[Math.min(idx + 1, allOptions.length - 1)]); }
    if (e.key === "ArrowUp")   { e.preventDefault(); onChange(allOptions[Math.max(idx - 1, 0)]); }
  };

  const wrapperClasses = [styles.wrapper, open ? styles.wrapperOpen : ""].filter(Boolean).join(" ");
  
  const triggerClasses = [
    styles.trigger,
    variant === "ghost" ? styles.triggerGhost : styles.triggerDefault,
    open ? styles.triggerOpen : "",
    disabled ? styles.triggerDisabled : "",
    className,
  ].join(" ");

  const dropdownClasses = [
    styles.dropdown,
    variant === "ghost" ? styles.dropdownGhost : "",
    openUpward ? styles.dropdownUp : styles.dropdownDown,
  ].join(" ");

  const renderOptionItem = (val: string, label: string) => {
    const isSelected = val === value;
    return (
      <li
        key={val}
        role="option"
        aria-selected={isSelected}
        data-selected={isSelected}
        className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          onChange(val);
          setOpen(false);
        }}
      >
        <span
          className={`${styles.optionLabel} ${getTextAlignClass(label)}`}
          dir={hasPersianChars(label) ? "rtl" : "ltr"}
        >
          {label}
        </span>
        {isSelected && <Check size={16} className={styles.checkIcon} strokeWidth={2.5} />}
      </li>
    );
  };

  // رندر مخصوص iOS
  if (isIOS) {
    return (
      <div className={wrapperClasses} data-dir={dir}>
        <div className={triggerClasses}>
          {!disabled && <ChevronDown size={16} strokeWidth={2.5} className={styles.chevron} />}
          <span
            className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""} ${getTextAlignClass(displayLabel || placeholder)}`}
            dir={hasPersianChars(displayLabel || placeholder) ? "rtl" : "ltr"}
          >
            {displayLabel || placeholder}
          </span>
        </div>
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={styles.nativeOverlay}
          aria-label={placeholder}
        >
          <option value="" disabled hidden>{placeholder}</option>
          {groups
            ? groups.map((group) => (
                <optgroup key={group.label} label={normalizeGroupLabel(group.label)}>
                  {group.options.map((opt) => (
                    <option key={`${group.label}-${opt}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              ))
            : labeledOptions
            ? labeledOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
            : options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  // رندر دسکتاپ و سایر دستگاه‌ها
  return (
    <div ref={wrapperRef} className={wrapperClasses} data-dir={dir}>
      <div
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        tabIndex={disabled ? -1 : 0}
        className={triggerClasses}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        {!disabled && <ChevronDown size={16} strokeWidth={2.5} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />}
        <span
          className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""} ${getTextAlignClass(displayLabel || placeholder)}`}
          dir={hasPersianChars(displayLabel || placeholder) ? "rtl" : "ltr"}
        >
          {displayLabel || placeholder}
        </span>
      </div>

      {open && (
        <div className={dropdownClasses}>
          <ul id={id} ref={listRef} role="listbox" className={styles.list}>
            {groups
              ? groups.map((group) => (
                  <React.Fragment key={group.label}>
                    <li
                      className={`${styles.groupHeader} ${getTextAlignClass(normalizeGroupLabel(group.label))}`}
                      role="presentation"
                      dir={hasPersianChars(normalizeGroupLabel(group.label)) ? "rtl" : "ltr"}
                    >
                      {normalizeGroupLabel(group.label)}
                    </li>
                    {group.options.map(opt => renderOptionItem(opt, opt))}
                  </React.Fragment>
                ))
              : labeledOptions
              ? labeledOptions.map(opt => renderOptionItem(opt.value, opt.label))
              : options.map(opt => renderOptionItem(opt, opt))}
          </ul>
        </div>
      )}
    </div>
  );
}