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
  id?: string;
  ariaLabel?: string;
};

const DROPDOWN_MAX_HEIGHT = 260;
const subscribePlatform = () => () => {};
const isIOSPlatform = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
  id: controlId,
  ariaLabel,
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
      typeaheadRef.current = { text: "", time: 0 };
      if (reason === "escape") triggerRef.current?.focus({ preventScroll: true });
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

  const labels = groups ? allOptions : labeledOptions ? labeledOptions.map(option => option.label) : allOptions;
  const expanded = open && !disabled && !isIOS;
  const displayLabel = !groups && labeledOptions
    ? (labeledOptions.find((o) => o.value === value)?.label ?? "")
    : value;

  const hasPersianChars = (text: string) => /[\u0600-\u06FF]/.test(text);
  const getTextAlignClass = (text: string) => (hasPersianChars(text) ? styles.textRtl : styles.textLtr);
  const normalizeGroupLabel = (label: string) => {
    if (dir === "rtl" && label === "Common") return "Common";
    if (dir === "rtl" && label === "All Countries") return "All Countries";
    return label;
  };

  const closeList = () => {
    setOpen(false);
    typeaheadRef.current = { text: "", time: 0 };
  };
  const openList = () => {
    if (disabled || !allOptions.length) return;
    typeaheadRef.current = { text: "", time: 0 };
    setActiveIndex(Math.max(0, allOptions.indexOf(value)));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = allOptions[index];
    closeList();
    if (disabled || option === undefined) return;
    triggerRef.current?.focus({ preventScroll: true });
    onChange(option);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape" && expanded) {
      e.preventDefault();
      e.stopPropagation();
      closeList();
      return;
    }
    if (e.key === "Tab") {
      if (expanded) choose(activeIndex);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (expanded) choose(activeIndex);
      else openList();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!allOptions.length) return;
      if (!expanded) {
        openList();
        if (e.key === "Home") setActiveIndex(0);
        else if (e.key === "End") setActiveIndex(allOptions.length - 1);
      } else if (e.altKey && e.key === "ArrowUp") choose(activeIndex);
      else if (e.key === "Home") setActiveIndex(0);
      else if (e.key === "End") setActiveIndex(allOptions.length - 1);
      else setActiveIndex(Math.max(0, Math.min(allOptions.length - 1, activeIndex + (e.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const now = e.timeStamp;
      const key = e.key.toLocaleLowerCase();
      const text = (now - typeaheadRef.current.time > 600 ? "" : typeaheadRef.current.text) + key;
      typeaheadRef.current = { text, time: now };
      const repeatedKey = [...text].every(character => character === key);
      const query = repeatedKey ? key : text;
      const start = repeatedKey ? (expanded ? activeIndex : allOptions.indexOf(value)) + 1 : 0;
      for (let offset = 0; offset < labels.length; offset++) {
        const index = (start + offset) % labels.length;
        if (labels[index].toLocaleLowerCase().startsWith(query)) {
          setOpen(true);
          setActiveIndex(index);
          break;
        }
      }
    }
  };

  const wrapperClasses = [styles.wrapper, expanded ? styles.wrapperOpen : ""].filter(Boolean).join(" ");
  
  const triggerClasses = [
    styles.trigger,
    variant === "ghost" ? styles.triggerGhost : styles.triggerDefault,
    expanded ? styles.triggerOpen : "",
    disabled ? styles.triggerDisabled : "",
    className,
  ].join(" ");

  const dropdownClasses = [
    styles.dropdown,
    variant === "ghost" ? styles.dropdownGhost : "",

  ].join(" ");

  const renderOptionItem = (val: string, label: string, index: number) => {
    const isSelected = index === allOptions.indexOf(value);
    return (
      <li
        key={`${index}-${val}`}
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
      <div className={wrapperClasses} data-dir={dir} dir={dir}>
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
          id={controlId}
          aria-label={ariaLabel ?? placeholder}
          dir={dir}
        >
          {!allOptions.includes("") && <option value="" disabled hidden>{placeholder}</option>}
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
    <div ref={wrapperRef} className={wrapperClasses} data-dir={dir} dir={dir}>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-autocomplete="none"
        aria-controls={expanded ? id : undefined}
        aria-label={ariaLabel ?? placeholder}
        aria-activedescendant={expanded && activeIndex >= 0 && activeIndex < allOptions.length ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={triggerClasses}
        onClick={() => expanded ? closeList() : openList()}
        onKeyDown={handleKeyDown}
      >
        {!disabled && <ChevronDown size={16} strokeWidth={2.5} className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} />}
        <span
          className={`${styles.triggerValue} ${!value ? styles.triggerPlaceholder : ""} ${getTextAlignClass(displayLabel || placeholder)}`}
          dir={hasPersianChars(displayLabel || placeholder) ? "rtl" : "ltr"}
        >
          {displayLabel || placeholder}
        </span>
      </button>

      {expanded && (
        <div ref={popoverRef} popover="manual" className={dropdownClasses} onClick={event => {
          // Cancel the enclosing label's default click on the trigger, which
          // would otherwise reopen the popup after mouse or touch selection.
          event.preventDefault();
          event.stopPropagation();
        }}>
          <ul id={id} ref={listRef} role="listbox" aria-label={ariaLabel ?? placeholder} className={styles.list}>
            {groups
              ? groups.map((group, groupIndex) => {
                  const startIndex = groups.slice(0, groupIndex).reduce((count, previous) => count + previous.options.length, 0);
                  const groupId = `${id}-group-${groupIndex}`;
                  return <li key={groupId} role="presentation">
                    <div id={groupId}
                      className={`${styles.groupHeader} ${getTextAlignClass(normalizeGroupLabel(group.label))}`}
                      dir={hasPersianChars(normalizeGroupLabel(group.label)) ? "rtl" : "ltr"}
                    >
                      {normalizeGroupLabel(group.label)}
                    </div>
                    <ul role="group" aria-labelledby={groupId} className={styles.groupOptions}>
                      {group.options.map((opt, index) => renderOptionItem(opt, opt, startIndex + index))}
                    </ul>
                  </li>;
                })
              : labeledOptions
              ? labeledOptions.map((opt, index) => renderOptionItem(opt.value, opt.label, index))
              : options.map((opt, index) => renderOptionItem(opt, opt, index))}
          </ul>
        </div>
      )}
    </div>
  );
}
