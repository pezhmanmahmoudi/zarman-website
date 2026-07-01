"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
// تغییر مسیر در صورت نیاز به دایرکتوری اصلی (ممکن است بخواهید SelectBox را ایمپورت کنید)
import { SelectBox } from "../SelectBox/SelectBox";
import s from "./DatePicker.module.css";

type CustomDatePickerProps = {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear() + 20; 
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

// آماده‌سازی آرایه‌ها برای SelectBox
const monthOptions = MONTHS.map((m, idx) => ({ label: m, value: idx.toString() }));
const yearOptions = YEARS.map(y => y.toString());

export default function CustomDatePicker({ value, onChange, placeholder = "dd/mm/yyyy", disabled = false }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [viewDate, setViewDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  // آپدیت هندلرها برای SelectBox که استرینگ برمی‌گرداند
  const handleMonthChange = (val: string) => {
    setViewDate(new Date(currentYear, parseInt(val), 1));
  };

  const handleYearChange = (val: string) => {
    setViewDate(new Date(parseInt(val), currentMonth, 1));
  };

  const handleSelectDate = (day: number) => {
    const selected = new Date(currentYear, currentMonth, day);
    const formattedDate = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const setToday = () => {
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setViewDate(today);
    onChange(formattedDate);
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange("");
    setIsOpen(false);
  };

  const renderDays = () => {
    const blanks = Array.from({ length: startingDayIndex }, (_, i) => (
      <div key={`blank-${i}`} className={`${s.dayBtn} ${s.empty}`} />
    ));

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNumber = i + 1;
      const isSelected = value === `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      
      const todayDate = new Date();
      const isToday = todayDate.getDate() === dayNumber && todayDate.getMonth() === currentMonth && todayDate.getFullYear() === currentYear;

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
      <div className={s.inputWrapper} onClick={() => !disabled && setIsOpen(!isOpen)}>
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
        <div className={s.popover}>
          <div className={s.header}>
            <button type="button" onClick={handlePrevMonth} className={s.navBtn} title="Previous Month">
              <ChevronLeft size={18} />
            </button>

            {/* در اینجا SelectBox فوق‌حرفه‌ای جایگزین شد */}
            <div className={s.selectors}>
              <SelectBox 
                variant="ghost"
                labeledOptions={monthOptions}
                value={currentMonth.toString()}
                onChange={handleMonthChange}
                className={s.monthSelectBox}
              />
              <SelectBox 
                variant="ghost"
                options={yearOptions}
                value={currentYear.toString()}
                onChange={handleYearChange}
                className={s.yearSelectBox}
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
            <button type="button" onClick={clearDate} className={s.footerBtn}>Clear</button>
            <button type="button" onClick={setToday} className={s.footerBtn}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}