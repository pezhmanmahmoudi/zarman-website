"use client";

import React, { useState, useRef, useEffect, useId, useSyncExternalStore } from "react";
import { ChevronDown, Check } from "lucide-react";
import styles from "./SelectBox.module.css";
import { useAnchoredPopover } from "../useAnchoredPopover";

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
const subscribePlatform = () => () => {};
const isIOSPlatform = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  || typeof HTMLElement.prototype.showPopover !== "function";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const isIOS = useSyncExternalStore(subscribePlatform, isIOSPlatform, () => false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ text: "", time: 0 });

  useAnchoredPopover({
    open: open && !disabled && !isIOS,
    anchorRef: wrapperRef,
    popoverRef,
    matchWidth: variant !== "ghost",
    align: dir === "rtl" ? "end" : "start",
    maxHeight: DROPDOWN_MAX_HEIGHT,
    onClose: reason => {
      setOpen(false);
      if (reason === "escape") triggerRef.current?.focus();
    },
  });

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>("[data-active='true']");
    if (!active) return;
    const list = listRef.current;
    if (active.offsetTop < list.scrollTop) list.scrollTop = active.offsetTop;
    else if (active.offsetTop + active.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = active.offsetTop + active.offsetHeight - list.clientHeight;
    }
  }, [open, activeIndex]);

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

  const openList = () => {
    setActiveIndex(Math.max(0, allOptions.indexOf(value)));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = allOptions[index];
    if (option !== undefined) onChange(option);
    setOpen(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "Tab") { setOpen(false); return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(activeIndex);
      else openList();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!allOptions.length) return;
      const current = open ? activeIndex : allOptions.indexOf(value);
      setOpen(true);
      if (e.key === "Home") setActiveIndex(0);
      else if (e.key === "End") setActiveIndex(allOptions.length - 1);
      else setActiveIndex(Math.max(0, Math.min(allOptions.length - 1, current + (e.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const text = (now - typeaheadRef.current.time > 600 ? "" : typeaheadRef.current.text) + e.key.toLocaleLowerCase();
      typeaheadRef.current = { text, time: now };
      const labels = labeledOptions ? labeledOptions.map(option => option.label) : allOptions;
      const match = labels.findIndex(label => label.toLocaleLowerCase().startsWith(text));
      if (match !== -1) { setOpen(true); setActiveIndex(match); }
    }
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

  ].join(" ");

  const renderOptionItem = (val: string, label: string) => {
    const isSelected = val === value;
    const index = allOptions.indexOf(val);
    return (
      <li
        key={val}
        id={`${id}-option-${index}`}
        role="option"
        aria-selected={isSelected}
        data-selected={isSelected}
        data-active={index === activeIndex}
        className={`${styles.option} ${isSelected ? styles.optionSelected : ""} ${index === activeIndex ? styles.optionActive : ""}`}
        onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }}
        onClick={() => choose(index)}
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
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={placeholder}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={triggerClasses}
        onClick={() => open ? setOpen(false) : openList()}
        onBlur={event => { if (event.relatedTarget && !wrapperRef.current?.contains(event.relatedTarget as Node)) setOpen(false); }}
        onKeyDown={handleKeyDown}
      >
        {!disabled && <ChevronDown size={16} strokeWidth={2.5} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />}
        <span
          className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""} ${getTextAlignClass(displayLabel || placeholder)}`}
          dir={hasPersianChars(displayLabel || placeholder) ? "rtl" : "ltr"}
        >
          {displayLabel || placeholder}
        </span>
      </button>

      {open && !disabled && (
        <div ref={popoverRef} popover="manual" className={dropdownClasses}>
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
