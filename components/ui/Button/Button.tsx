// components/common/Button.tsx
"use client";

import Link from "next/link";
import React from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "soft";
type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;

  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  loading?: boolean;
  disabled?: boolean;

  className?: string;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function sizeClass(size: ButtonSize) {
  if (size === "sm") return styles.sizeSm;
  if (size === "lg") return styles.sizeLg;
  return styles.sizeMd;
}

function variantClass(variant: ButtonVariant) {
  if (variant === "secondary") return styles.secondary;
  if (variant === "ghost") return styles.ghost;
  if (variant === "soft") return styles.soft;
  return styles.primary;
}

function spinnerToneClass(variant: ButtonVariant) {
  // فقط primary spinner سفید است؛ بقیه تیره
  return variant === "primary" ? "" : styles.secondarySpinner;
}

export default function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    fullWidth,
    leftIcon,
    rightIcon,
    loading = false,
    disabled = false,
    className,
    ...rest
  } = props;

  const isDisabled = Boolean(disabled || loading);

  const baseClass = cx(
    styles.root,
    styles.btn,
    sizeClass(size),
    variantClass(variant),
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    loading && styles.loading,
    className
  );

  const content = (
    <>
      {loading ? (
        <span className={cx(styles.spinner, spinnerToneClass(variant))} aria-hidden="true" />
      ) : leftIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      <span className={styles.label}>{children}</span>

      {!loading && rightIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </>
  );

  // LINK
  if ("href" in props) {
    const { href, onClick, ...anchorProps } = rest as ButtonAsLink;

    return (
      <Link
        href={href}
        className={baseClass}
        aria-disabled={isDisabled ? "true" : undefined}
        tabIndex={isDisabled ? -1 : undefined}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        {...anchorProps}
      >
        {content}
      </Link>
    );
  }

  // BUTTON
  const buttonProps = rest as ButtonAsButton;

  // جلوگیری از submit ناخواسته (مخصوصاً اگر داخل form قرار بگیرد)
  const type = buttonProps.type ?? "button";

  return (
    <button className={baseClass} disabled={isDisabled} type={type} {...buttonProps}>
      {content}
    </button>
  );
}
