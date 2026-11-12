"use client";

import React, { useMemo, useState, useRef, useId } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { SelectBox } from "../SelectBox/SelectBox";
import s from "./DatePicker.module.css";
import { isInsidePopoverStack, useAnchoredPopover, useFloatingLayer } from "../useAnchoredPopover";

type CustomDatePickerProps = {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Which years the month/year lists offer. The year of the current value is always included. */
  years?: YearRange;
};

export type YearRange = "any" | "recent" | "future" | "birth" | "expiry" | "issue";

const parseIsoDate = (raw: string) => {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day ? parsed : null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Year bounds per use: dates of birth never lie ahead, expiry dates lie ahead, ledger dates are recent. */
const yearBounds = (range: YearRange, thisYear: number): [number, number] => {
  switch (range) {
    case "recent": return [thisYear - 10, thisYear + 1];
    case "future": return [thisYear - 1, thisYear + 10];
    case "birth": return [1900, thisYear];
    case "expiry": return [thisYear - 5, thisYear + 20];
    case "issue": return [thisYear - 10, thisYear];
    default: return [1900, thisYear + 20];
  }
};

const monthOptions = MONTHS.map((m, idx) => ({ label: m, value: idx.toString() }));

const displayDate = (raw: string) => { const parsed = parseIsoDate(raw); return parsed ? `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}` : raw; };

export default function CustomDatePicker({ value, onChange, placeholder = "dd/mm/yyyy", disabled = false, className, years = "any" }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [viewDate, setViewDate] = useState(() => {
    return parseIsoDate(value) ?? new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarId = useId();
  const floatingLayer = useFloatingLayer();
  useAnchoredPopover({
    open: isOpen && !disabled,
    anchorRef: containerRef,
    popoverRef,
    align: "end",
    maxHeight: 420,
    onClose: reason => {
      setIsOpen(false);
      if (reason === "escape") triggerRef.current?.focus();
    },
  });
  const toggleCalendar = () => {
    if (disabled) return;
    if (!isOpen) setViewDate(parseIsoDate(value) ?? new Date());
    setIsOpen(open => !open);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const yearOptions = useMemo(() => {
    const [low, high] = yearBounds(years, new Date().getFullYear());
    const selected = parseIsoDate(value)?.getFullYear();
    const first = Math.min(low, selected ?? low, currentYear);
    const last = Math.max(high, selected ?? high, currentYear);
    return Array.from({ length: last - first + 1 }, (_, index) => String(first + index));
  }, [years, value, currentYear]);
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const handleMonthChange = (val: string) => {
    setViewDate(new Date(currentYear, parseInt(val, 10), 1));
  };

  const handleYearChange = (val: string) => {
    setViewDate(new Date(parseInt(val, 10), currentMonth, 1));
  };

  const handleSelectDate = (day: number) => {
    const selected = new Date(currentYear, currentMonth, day);
    const formattedDate = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`;
    onChange(formattedDate);
    // با انتخاب تاریخ دیگر تقویم بسته نمی‌شود تا کاربر روی دکمه OK کلیک کند
  };

  const setToday = () => {
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setViewDate(today);
    onChange(formattedDate);
  };

  const clearDate = () => {
    onChange("");
  };

  const handleOk = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const renderDays = () => {
    const todayDate = new Date();
    const todayYear = todayDate.getFullYear();
    const todayMonth = todayDate.getMonth();
    const todayDay = todayDate.getDate();

    const blanks = Array.from({ length: startingDayIndex }, (_, i) => (
      <div key={`blank-${i}`} className={`${s.dayBtn} ${s.empty}`} />
    ));

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNumber = i + 1;
      const isSelected = value === `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      const isToday = todayDay === dayNumber && todayMonth === currentMonth && todayYear === currentYear;

      return (
        <button
          key={`day-${dayNumber}`}
          type="button"
          onClick={() => handleSelectDate(dayNumber)}
          aria-pressed={isSelected}
          aria-label={`${dayNumber} ${MONTHS[currentMonth]} ${currentYear}`}
          aria-current={isToday ? "date" : undefined}
          className={`${s.dayBtn} ${isSelected ? s.daySelected : ""} ${isToday ? s.dayToday : ""}`}
        >
          {dayNumber}
        </button>
      );
    });

    return [...blanks, ...days];
  };

  return (
    <div className={s.container} ref={containerRef} onBlur={event => {
      // The calendar may be portaled outside the container on browsers without the Popover API.
      if (event.relatedTarget && !containerRef.current?.contains(event.relatedTarget as Node)
        && !isInsidePopoverStack(popoverRef.current, event.relatedTarget)) setIsOpen(false);
    }}>
      <div className={`${s.inputWrapper}${className ? " " + className : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={`${s.input} ${isOpen ? s.inputActive : ""} ${value ? "" : s.inputEmpty}`}
          aria-label={value ? `Date: ${value}` : placeholder}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? calendarId : undefined}
          onClick={toggleCalendar}
          onKeyDown={event => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!isOpen) { setViewDate(parseIsoDate(value) ?? new Date()); setIsOpen(true); }
              requestAnimationFrame(() => popoverRef.current?.querySelector<HTMLElement>("button")?.focus());
            }
          }}
        >{displayDate(value) || placeholder}</button>
        <CalendarIcon size={18} className={s.icon} aria-hidden="true" />
      </div>

      {isOpen && !disabled && floatingLayer(
        <div id={calendarId} ref={popoverRef} popover="manual" role="dialog" aria-label="Choose date" className={s.popover}>
          <div className={s.header}>
            <button type="button" onClick={handlePrevMonth} className={s.navBtn} title="Previous Month">
              <ChevronLeft size={18} />
            </button>

            <div className={s.selectors}>
              <SelectBox 
                variant="ghost"
                placeholder="Month"
                className={s.calendarSelect}
                dir="ltr"
                labeledOptions={monthOptions}
                value={currentMonth.toString()}
                onChange={handleMonthChange}
              />
              <SelectBox 
                variant="ghost"
                placeholder="Year"
                className={s.calendarSelect}
                dir="ltr"
                options={yearOptions}
                value={currentYear.toString()}
                onChange={handleYearChange}
              />
            </div>

            <button type="button" onClick={handleNextMonth} className={s.navBtn} title="Next Month">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className={s.grid}>
            {DAYS.map(day => <div key={day} className={s.dayOfWeek}>{day}</div>)}
            {renderDays()}
          </div>

          <div className={s.footer}>
            <div className={s.footerLeft}>
              <button type="button" onClick={clearDate} className={s.footerBtn}>Clear</button>
              <button type="button" onClick={setToday} className={s.footerBtn}>Today</button>
            </div>
            <button type="button" onClick={handleOk} className={`${s.footerBtn} ${s.okBtn}`}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
