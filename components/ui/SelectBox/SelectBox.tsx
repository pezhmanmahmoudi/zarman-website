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
  variant?: "default" | "ghost"; // <-- استایل جدید اضافه شد
};

const DROPDOWN_MAX_HEIGHT = 272;
const DROPDOWN_GAP = 6;

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
  variant = "default",
}: SelectBoxProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }, []);

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP);
  }, [open]);

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

  useEffect(() => {
    if (open && listRef.current && value) {
      const selected = listRef.current.querySelector("[data-selected='true']") as HTMLElement | null;
      selected?.scrollIntoView({ block: "nearest" });
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    if (e.key === "Escape") setOpen(false);
    if (!open) return;
    const idx = allOptions.indexOf(value);
    if (e.key === "ArrowDown") { e.preventDefault(); onChange(allOptions[Math.min(idx + 1, allOptions.length - 1)]); }
    if (e.key === "ArrowUp")   { e.preventDefault(); onChange(allOptions[Math.max(idx - 1, 0)]); }
  };

  const triggerVariantClass = variant === "ghost" ? styles.triggerGhost : styles.triggerDefault;

  const triggerClass = [
    styles.trigger,
    triggerVariantClass,
    open ? styles.triggerOpen : "",
    disabled ? styles.triggerDisabled : "",
  ].join(" ");

  const dropdownClass = [
    styles.dropdown,
    variant === "ghost" ? styles.dropdownGhost : "",
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
          onMouseDown={(e) => {
            e.preventDefault();
            onChange(opt);
            setOpen(false);
          }}
        >
          {isSelected && dir === "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
          <span className={styles.optionLabel}>{opt}</span>
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
          onMouseDown={(e) => {
            e.preventDefault();
            onChange(opt.value);
            setOpen(false);
          }}
        >
          {isSelected && dir === "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
          <span className={styles.optionLabel}>{opt.label}</span>
          {isSelected && dir !== "rtl" && <Check size={14} className={styles.checkIcon} strokeWidth={2.5} />}
        </li>
      );
    });

  if (isIOS) {
    const nativeOpts = labeledOptions
      ? labeledOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
      : groups
      ? groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        ))
      : options.map((o) => <option key={o} value={o}>{o}</option>);

    return (
      <div className={`${styles.wrapper}${className ? " " + className : ""}`} {...(dir ? { "data-dir": dir } : {})}>
        <div className={`${styles.trigger} ${triggerVariantClass} ${disabled ? styles.triggerDisabled : ""}`}>
          <span className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""}`}>
            {displayLabel || placeholder}
          </span>
          <ChevronDown size={16} strokeWidth={2.5} className={styles.chevron} />
        </div>
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
    <div ref={wrapperRef} className={`${styles.wrapper}${className ? " " + className : ""}`} {...(dir ? { "data-dir": dir } : {})}>
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
        <span className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""}`}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown size={16} strokeWidth={2.5} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </div>

      {open && (
        <div className={dropdownClass}>
          <ul id={id} ref={listRef} role="listbox" className={styles.list}>
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