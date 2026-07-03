"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { SelectBox } from "../SelectBox/SelectBox";
import s from "./DatePicker.module.css";

type CustomDatePickerProps = {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const parseIsoDate = (raw: string) => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const [openUpward, setOpenUpward] = useState(false);
  
  const [viewDate, setViewDate] = useState(() => {
    return parseIsoDate(value) ?? new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // رفع باگ: بررسی اینکه آیا عنصر کلیک شده هنوز در دام (DOM) وجود دارد یا خیر.
      // اگر عنصر حذف شده باشد (مثل کلیک روی گزینه‌های سلکت‌باکس)، تقویم نباید بسته شود.
      if (document.contains(target) && containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const parsed = parseIsoDate(value);
    if (parsed) {
      setViewDate(parsed);
    }
  }, [value]);

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
          className={`${s.dayBtn} ${isSelected ? s.daySelected : ""} ${isToday ? s.dayToday : ""}`}
        >
          {dayNumber}
        </button>
      );
    });

    return [...blanks, ...days];
  };

  return (
    <div className={s.container} ref={containerRef}>
      <div className={`${s.inputWrapper}${className ? " " + className : ""}`} onClick={() => {
        if (disabled) return;
        if (!isOpen) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const spaceBelow = window.innerHeight - rect.bottom;
            setOpenUpward(spaceBelow < 340);
          }
        }
        setIsOpen((o) => !o);
      }}>
        <input
          type="text"
          readOnly
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          className={`${s.input} ${isOpen ? s.inputActive : ""}`}
        />
        <CalendarIcon size={18} className={s.icon} />
      </div>

      {isOpen && (
        <div className={`${s.popover} ${openUpward ? s.popoverUp : ""}`}>
          <div className={s.header}>
            <button type="button" onClick={handlePrevMonth} className={s.navBtn} title="Previous Month">
              <ChevronLeft size={18} />
            </button>

            <div className={s.selectors}>
              <SelectBox 
                variant="ghost"
                labeledOptions={monthOptions}
                value={currentMonth.toString()}
                onChange={handleMonthChange}
              />
              <SelectBox 
                variant="ghost"
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