"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { AdminDialog } from "@/components/admin/ui/AdminDialog";
import styles from "@/styles/admin/AdminFieldEditor.module.css";

type AdminFieldEditorProps = {
  value: string;
  displayValue: React.ReactNode;
  label: string;
  description: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  inputMode?: "text" | "decimal";
  maxLength?: number;
  suffix?: string;
  transformInput?: (value: string) => string;
  variant?: "amount" | "reference" | "customer";
};

/** Keeps row editors out of scrolling tables and gives touch users a full form. */
export function AdminFieldEditor({
  value, displayValue, label, description, onSave, placeholder,
  inputMode = "text", maxLength, suffix, transformInput, variant = "reference",
}: AdminFieldEditorProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const openEditor = () => {
    setDraft(value);
    setError(null);
    setOpen(true);
  };

  const closeEditor = () => {
    if (submitting.current) return;
    setOpen(false);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A ref also covers repeated Enter presses before React renders disabled controls.
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your changes. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div className={styles.valueGroup} data-variant={variant}>
      <span className={styles.value}>{displayValue}</span>
      <button
        type="button"
        className={styles.editButton}
        onClick={openEditor}
        aria-label={`Edit ${label}`}
        aria-haspopup="dialog"
      >
        <Pencil size={13} aria-hidden="true" />
        Edit
      </button>
      {open && <AdminDialog
        open={open}
        onClose={closeEditor}
        dismissible={!saving}
        initialFocusRef={inputRef}
        labelledBy={`${id}-title`}
        describedBy={`${id}-description`}
        className={styles.dialog}
      >
        <form className={styles.form} onSubmit={handleSubmit} aria-busy={saving} noValidate>
          <div className={styles.header}>
            <div>
              <h2 id={`${id}-title`} className={styles.title}>Edit {label}</h2>
              <p id={`${id}-description`} className={styles.description}>{description}</p>
            </div>
            <button type="button" className={styles.closeButton} onClick={closeEditor} disabled={saving} aria-label="Close editor">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.body}>
            <div className={styles.currentValue}>
              <span>Current value</span>
              <strong>{displayValue}{suffix && <span> {suffix}</span>}</strong>
            </div>
            <label className={styles.label} htmlFor={`${id}-input`}>{label}</label>
            <div className={styles.inputWrap}>
              <input
                ref={inputRef}
                id={`${id}-input`}
                className={styles.input}
                type="text"
                inputMode={inputMode}
                enterKeyHint="done"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={event => {
                  const nextValue = event.target.value;
                  setDraft(transformInput ? transformInput(nextValue) : nextValue);
                  setError(null);
                }}
                disabled={saving}
                placeholder={placeholder}
                maxLength={maxLength}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              {suffix && <span className={styles.suffix} aria-hidden="true">{suffix}</span>}
            </div>
            {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={closeEditor} disabled={saving}>Cancel</button>
            <button type="submit" className={styles.saveButton} disabled={saving}>
              {saving && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}
              {saving ? "Saving changes…" : "Save changes"}
            </button>
          </div>
        </form>
      </AdminDialog>}
    </div>
  );
}
