"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import styles from "./SelectBox.module.css";

export type OptionGroup = { label: string; options: string[] };
export type LabeledOption = { label: string; value: string };

export type SelectBoxProps = {
  /** Flat list of options — value === label (use either this or `labeledOptions` or `groups`) */
  options?: string[];
  /** Options with separate display label and internal value */
  labeledOptions?: LabeledOption[];
  /** Grouped options with section headers */
  groups?: OptionGroup[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Extra class applied to the wrapper for per-instance overrides */
  className?: string;
  /** Text direction for the trigger label — use "rtl" for Persian labels */
  dir?: "ltr" | "rtl";
};

const DROPDOWN_MAX_HEIGHT = 272; // px — matches CSS max-height + padding
const DROPDOWN_GAP = 6;          // gap between trigger and panel

export function SelectBox({
  options = [],
  labeledOptions,
  groups,
  value,
  onChange,
  placeholder = "Select\u2026",
  disabled = false,
  className,
  dir,
}: SelectBoxProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  // Detect iOS — must run after mount to avoid SSR mismatch
  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }, []);

  // Decide open direction before paint
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll selected item into view when opening
  useEffect(() => {
    if (open && listRef.current && value) {
      const selected = listRef.current.querySelector("[data-selected='true']") as HTMLElement | null;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [open, value]);

  // Flatten all options for keyboard nav
  const allOptions = groups
    ? groups.flatMap((g) => g.options)
    : labeledOptions
    ? labeledOptions.map((o) => o.value)
    : options;

  // Display label for the trigger
  const displayLabel = labeledOptions
    ? (labeledOptions.find((o) => o.value === value)?.label ?? "")
    : value;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    if (e.key === "Escape") setOpen(false);
    if (!open) return;
    const idx = allOptions.indexOf(value);
    if (e.key === "ArrowDown") { e.preventDefault(); onChange(allOptions[Math.min(idx + 1, allOptions.length - 1)]); }
    if (e.key === "ArrowUp")   { e.preventDefault(); onChange(allOptions[Math.max(idx - 1, 0)]); }
  };

  const triggerClass = [
    styles.trigger,
    open ? styles.triggerOpen : "",
    disabled ? styles.triggerDisabled : "",
  ].join(" ");

  const dropdownClass = [
    styles.dropdown,
    openUpward ? styles.dropdownUp : styles.dropdownDown,
  ].join(" ");

  const renderOptions = (opts: string[]) =>
    opts.map((opt) => {
      const isSelected = opt === value;
      return (
        <li
          key={opt}
          role="option"
          aria-selected={isSelected}
          data-selected={isSelected}
          className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
          style={dir === "rtl" ? { direction: "rtl", fontFamily: "var(--font-primary)" } : undefined}
          onMouseDown={(e) => {
            e.preventDefault();
            onChange(opt);
            setOpen(false);
          }}
        >
          {isSelected && dir === "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
          <span style={dir === "rtl" ? { textAlign: "right", flex: 1 } : undefined}>{opt}</span>
          {isSelected && dir !== "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
        </li>
      );
    });

  const renderLabeledOptions = (opts: LabeledOption[]) =>
    opts.map((opt) => {
      const isSelected = opt.value === value;
      return (
        <li
          key={opt.value}
          role="option"
          aria-selected={isSelected}
          data-selected={isSelected}
          className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
          style={dir === "rtl" ? { direction: "rtl", fontFamily: "var(--font-primary)" } : undefined}
          onMouseDown={(e) => {
            e.preventDefault();
            onChange(opt.value);
            setOpen(false);
          }}
        >
          {isSelected && dir === "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
          <span style={dir === "rtl" ? { textAlign: "right", flex: 1 } : undefined}>{opt.label}</span>
          {isSelected && dir !== "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
        </li>
      );
    });

  // ── iOS: styled trigger + transparent native <select> overlay ──────
  if (isIOS) {
    const nativeOpts = labeledOptions
      ? labeledOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))
      : groups
      ? groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        ))
      : options.map((o) => <option key={o} value={o}>{o}</option>);

    return (
      <div
        className={`${styles.wrapper}${className ? " " + className : ""}`}
        style={dir === "rtl" ? { direction: "rtl", position: "relative" } : { position: "relative" }}
        {...(dir ? { "data-dir": dir } : {})}
      >
        {/* Visual trigger — purely decorative on iOS */}
        <div className={`${styles.trigger} ${disabled ? styles.triggerDisabled : ""}`}>
          <span
            className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""}`}
            style={dir === "rtl" ? { textAlign: "right", fontFamily: "var(--font-primary)", direction: "rtl" } : undefined}
          >
            {displayLabel || placeholder}
          </span>
          <ChevronDown size={16} strokeWidth={2.5} className={styles.chevron} />
        </div>
        {/* Invisible native select — captures tap and opens iOS picker */}
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={styles.nativeOverlay}
          aria-label={placeholder}
        >
          <option value="" disabled hidden>{placeholder}</option>
          {nativeOpts}
        </select>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper}${className ? " " + className : ""}`}
      style={dir === "rtl" ? { direction: "rtl" } : undefined}
      {...(dir ? { "data-dir": dir } : {})}
    >
      <div
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        tabIndex={disabled ? -1 : 0}
        className={triggerClass}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span
          className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""}`}
          style={dir === "rtl" ? { textAlign: "right", fontFamily: "var(--font-primary)", direction: "rtl" } : undefined}
        >
          {displayLabel || placeholder}
        </span>
        <ChevronDown size={16} strokeWidth={2.5} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </div>

      {open && (
        <div className={dropdownClass}>
          <ul id={id} ref={listRef} role="listbox" className={styles.list}
            style={dir === "rtl" ? { direction: "rtl" } : undefined}
          >
            {groups
              ? groups.map((group) => (
                  <React.Fragment key={group.label}>
                    <li className={styles.groupHeader} role="presentation">{group.label}</li>
                    {renderOptions(group.options)}
                  </React.Fragment>
                ))
              : labeledOptions
              ? renderLabeledOptions(labeledOptions)
              : renderOptions(options)}
          </ul>
        </div>
      )}
    </div>
  );
}

