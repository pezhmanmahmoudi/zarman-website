"use client";

import React, { useState, useRef, useId } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { SelectBox } from "../SelectBox/SelectBox";
import s from "./DatePicker.module.css";
import { useAnchoredPopover } from "../useAnchoredPopover";

type CustomDatePickerProps = {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

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

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear() + 20; 
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

const monthOptions = MONTHS.map((m, idx) => ({ label: m, value: idx.toString() }));
const yearOptions = YEARS.map(y => y.toString());

export default function CustomDatePicker({ value, onChange, placeholder = "dd/mm/yyyy", disabled = false, className }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [viewDate, setViewDate] = useState(() => {
    return parseIsoDate(value) ?? new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarId = useId();
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
      if (event.relatedTarget && !containerRef.current?.contains(event.relatedTarget as Node)) setIsOpen(false);
    }}>
      <div className={`${s.inputWrapper}${className ? " " + className : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={`${s.input} ${isOpen ? s.inputActive : ""}`}
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
        >{value || placeholder}</button>
        <CalendarIcon size={18} className={s.icon} aria-hidden="true" />
      </div>

      {isOpen && !disabled && (
        <div id={calendarId} ref={popoverRef} popover="manual" role="dialog" aria-label="Choose date" className={s.popover}>
          <div className={s.header}>
            <button type="button" onClick={handlePrevMonth} className={s.navBtn} title="Previous Month">
              <ChevronLeft size={18} />
            </button>

            <div className={s.selectors}>
              <SelectBox 
                variant="ghost"
                placeholder="Month"
                dir="ltr"
                labeledOptions={monthOptions}
                value={currentMonth.toString()}
                onChange={handleMonthChange}
              />
              <SelectBox 
                variant="ghost"
                placeholder="Year"
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
