"use client";

import React, { useRef, useState } from "react";
import styles from "@/styles/admin/AdminSecurity.module.css";

const LENGTH = 6;

/**
 * Six-digit code entry. One real (invisible) input sits over six display boxes, so typing, pasting,
 * backspace, mobile keyboards and one-time-code autofill all behave like a normal text field.
 */
export function OtpInput({ value, onChange, onComplete, disabled = false, autoFocus = false, invalid = false, id, label = "Authenticator code" }: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  id?: string;
  label?: string;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const active = Math.min(value.length, LENGTH - 1);

  return (
    <div className={styles.otp} onClick={() => input.current?.focus()}>
      <div className={styles.otpBoxes} aria-hidden="true">
        {Array.from({ length: LENGTH }, (_, index) => (
          <span
            key={index}
            className={`${styles.otpBox} ${focused && index === active ? styles.otpBoxActive : ""} ${invalid ? styles.otpBoxInvalid : ""} ${value[index] ? styles.otpBoxFilled : ""}`}
          >
            {value[index] ?? ""}
          </span>
        ))}
      </div>
      <input
        ref={input}
        id={id}
        className={styles.otpInput}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={LENGTH}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={event => {
          const next = event.target.value.replace(/\D/g, "").slice(0, LENGTH);
          onChange(next);
          if (next.length === LENGTH) onComplete?.(next);
        }}
      />
    </div>
  );
}
