"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { normalizeAustralianState } from "@/lib/australian-driver-licence";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import { useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

type AuLocationEntry = {
  suburb: string;
  postcode: string;
};

type FieldErrors = {
  state?: string;
  city?: string;
  postalCode?: string;
};

type Props = {
  state: string;
  city: string;
  postalCode: string;
  disabled?: boolean;
  errors?: FieldErrors;
  ui?: {
    fieldGroupClassName?: string;
    labelClassName?: string;
    inputClassName?: string;
    selectClassName?: string;
    stateLabel?: string;
    postcodeLabel?: string;
    errorTextClassName?: string;
    hintTextClassName?: string;
    requiredMarkClassName?: string;
  };
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
};

const AU_STATE_OPTIONS = [
  { value: "ACT", label: "ACT (Australian Capital Territory)" },
  { value: "NSW", label: "NSW (New South Wales)" },
  { value: "NT", label: "NT (Northern Territory)" },
  { value: "QLD", label: "QLD (Queensland)" },
  { value: "SA", label: "SA (South Australia)" },
  { value: "TAS", label: "TAS (Tasmania)" },
  { value: "VIC", label: "VIC (Victoria)" },
  { value: "WA", label: "WA (Western Australia)" },
];

const AU_LOCATION_LOADERS: Record<string, () => Promise<{ default: AuLocationEntry[] }>> = {
  ACT: () => import("@/lib/au-locations/ACT.json"),
  NSW: () => import("@/lib/au-locations/NSW.json"),
  NT: () => import("@/lib/au-locations/NT.json"),
  QLD: () => import("@/lib/au-locations/QLD.json"),
  SA: () => import("@/lib/au-locations/SA.json"),
  TAS: () => import("@/lib/au-locations/TAS.json"),
  VIC: () => import("@/lib/au-locations/VIC.json"),
  WA: () => import("@/lib/au-locations/WA.json"),
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export function filterSuggestions(values: string[], query: string) {
  const normalizedQuery = query.trim().toUpperCase();
  if (!normalizedQuery) return values.slice(0, 100);

  const prefixMatches = values.filter((value) => value.toUpperCase().startsWith(normalizedQuery));
  if (prefixMatches.length >= 100) return prefixMatches.slice(0, 100);

  const containsMatches = values.filter((value) => {
    const normalizedValue = value.toUpperCase();
    return normalizedValue.includes(normalizedQuery) && !normalizedValue.startsWith(normalizedQuery);
  });

  return [...prefixMatches, ...containsMatches].slice(0, 100);
}

type SuggestionFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  suggestions: string[];
  helperText: string;
  errorText?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  fieldGroupClassName: string;
  labelClassName: string;
  inputClassName: string;
  errorTextClassName: string;
  hintTextClassName: string;
  requiredMarkClassName: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
};

export function SuggestionField({
  label,
  value,
  placeholder,
  disabled,
  suggestions,
  helperText,
  errorText,
  inputMode,
  fieldGroupClassName,
  labelClassName,
  inputClassName,
  errorTextClassName,
  hintTextClassName,
  requiredMarkClassName,
  onChange,
  onSelect,
}: SuggestionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const trimmedValue = value.trim();
  const hasSuggestions = suggestions.length > 0;
  const showDropdown = !disabled && isOpen && hasSuggestions;

  useAnchoredPopover({
    open: showDropdown, anchorRef: shellRef, popoverRef,
    matchWidth: true, maxHeight: 260,
    onClose: () => { setIsOpen(false); setActiveIndex(-1); },
  });
  const visibleSuggestions = suggestions.slice(0, 8);
  useEffect(() => {
    if (showDropdown && activeIndex >= 0) {
      popoverRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [showDropdown, activeIndex]);
  const choose = (suggestion: string) => {
    // Touch can focus the option button. Restore the input before closing so
    // its onFocus handler cannot reopen the suggestions after selection.
    inputRef.current?.focus({ preventScroll: true });
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(suggestion);
  };

  return (
    <div className={fieldGroupClassName}>
      <label className={labelClassName} htmlFor={`${listboxId}-input`}>{label} <span className={requiredMarkClassName}>*</span></label>
      <div className={styles.auSuggestionShell} ref={shellRef}>
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (hasSuggestions) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={[inputClassName, errorText ? styles.errorBorder : "", styles.auSuggestionInput].filter(Boolean).join(" ")}
          disabled={disabled}
          inputMode={inputMode}
          autoComplete="off"
          aria-invalid={Boolean(errorText)}
          aria-describedby={`${listboxId}-hint${errorText ? ` ${listboxId}-error` : ""}`}
          aria-activedescendant={showDropdown && activeIndex >= 0 && visibleSuggestions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
          onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex(index => Math.max(0, Math.min(visibleSuggestions.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
            } else if (event.key === "Enter" && showDropdown && visibleSuggestions[activeIndex]) {
              event.preventDefault();
              choose(visibleSuggestions[activeIndex]);
            } else if (event.key === "Escape" || event.key === "Tab") {
              if (event.key === "Escape" && showDropdown) {
                event.preventDefault();
                event.stopPropagation();
              }
              setIsOpen(false);
              setActiveIndex(-1);
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
        />
        <button
          type="button"
          className={styles.auSuggestionToggle}
          onClick={() => {
            if (!disabled && hasSuggestions) {
              inputRef.current?.focus({ preventScroll: true });
              setIsOpen(!showDropdown);
            }
          }}
          disabled={disabled || !hasSuggestions}
          aria-label={`Toggle ${label} suggestions`}
          tabIndex={-1}
        >
          <ChevronDown size={16} className={showDropdown ? styles.auSuggestionChevronOpen : ""} />
        </button>
        {showDropdown && (
          <div ref={popoverRef} popover="manual" dir="ltr" className={styles.auSuggestionDropdown} role="listbox" aria-label={label} id={listboxId}>
            {visibleSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={trimmedValue.toUpperCase() === suggestion.toUpperCase()}
                tabIndex={-1}
                className={`${styles.auSuggestionOption} ${index === activeIndex || trimmedValue.toUpperCase() === suggestion.toUpperCase() ? styles.auSuggestionOptionActive : ""}`}
                onPointerDown={event => { if(event.pointerType === "mouse") event.preventDefault(); }}
                onClick={() => choose(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      <span id={`${listboxId}-hint`} className={hintTextClassName}>{helperText}</span>
      {errorText && <span id={`${listboxId}-error`} className={errorTextClassName}>{errorText}</span>}
    </div>
  );
}

export function AustralianLocationFields({
  state,
  city,
  postalCode,
  disabled = false,
  errors,
  ui,
  onStateChange,
  onCityChange,
  onPostalCodeChange,
}: Props) {
  const [locations, setLocations] = useState<AuLocationEntry[]>([]);
  const normalizedState = normalizeAustralianState(state);

  useEffect(() => {
    if (!normalizedState || !AU_LOCATION_LOADERS[normalizedState]) {
      return;
    }

    let isCancelled = false;

    AU_LOCATION_LOADERS[normalizedState]()
      .then((module) => {
        if (isCancelled) return;
        setLocations(module.default ?? []);
      });

    return () => {
      isCancelled = true;
    };
  }, [normalizedState]);

  useEffect(() => {
    const normalizedCity = city.trim().toUpperCase();
    if (!normalizedCity) return;

    const exactCityMatches = locations.filter((entry) => entry.suburb.toUpperCase() === normalizedCity);
    const matchingPostcodes = uniqueStrings(exactCityMatches.map((entry) => entry.postcode));
    if (matchingPostcodes.length === 1 && postalCode !== matchingPostcodes[0]) {
      onPostalCodeChange(matchingPostcodes[0]);
    }
  }, [city, locations, onPostalCodeChange, postalCode]);

  useEffect(() => {
    const normalizedPostcode = postalCode.trim();
    if (!normalizedPostcode) return;

    const exactPostcodeMatches = locations.filter((entry) => entry.postcode === normalizedPostcode);
    const matchingSuburbs = uniqueStrings(exactPostcodeMatches.map((entry) => entry.suburb));
    if (matchingSuburbs.length === 1 && city.trim().toUpperCase() !== matchingSuburbs[0].toUpperCase()) {
      onCityChange(matchingSuburbs[0]);
    }
  }, [city, locations, onCityChange, postalCode]);

  const isLoading = Boolean(normalizedState) && locations.length === 0;

  const availableSuburbs = uniqueStrings(locations.map((entry) => entry.suburb));
  const suburbSuggestions = filterSuggestions(availableSuburbs, city);
  const postcodeMatchesForCity = city.trim()
    ? locations.filter((entry) => entry.suburb.toUpperCase() === city.trim().toUpperCase())
    : [];
  const availablePostcodes = postcodeMatchesForCity.length > 0
    ? uniqueStrings(postcodeMatchesForCity.map((entry) => entry.postcode))
    : uniqueStrings(locations.map((entry) => entry.postcode));
  const postcodeSuggestions = filterSuggestions(availablePostcodes, postalCode);
  const suburbHelper = isLoading
    ? "Loading suburbs for the selected state..."
    : city.trim() && postcodeMatchesForCity.length > 1
    ? "This suburb has multiple postcodes. Choose the matching postcode below."
    : "Choose your suburb to auto-fill the postcode when there is a unique match.";
  const fieldGroupClassName = ui?.fieldGroupClassName ?? styles.inputGroup;
  const labelClassName = ui?.labelClassName ?? "";
  const inputClassName = ui?.inputClassName ?? "";
  const errorTextClassName = ui?.errorTextClassName ?? styles.errorText;
  const hintTextClassName = ui?.hintTextClassName ?? styles.fieldHint;
  const requiredMarkClassName = ui?.requiredMarkClassName ?? styles.req;
  const cityInputClassName = inputClassName;
  const postcodeInputClassName = inputClassName;

  return (
    <>
      <div className={fieldGroupClassName}>
        <label className={labelClassName}>{ui?.stateLabel ?? "State/Province"} <span className={requiredMarkClassName}>*</span></label>
        <SelectBox
          value={normalizedState}
          onChange={(value) => onStateChange(value)}
          placeholder="Select state..."
          labeledOptions={AU_STATE_OPTIONS}
          disabled={disabled}
          dir="ltr"
          className={ui?.selectClassName ?? inputClassName}
        />
        {errors?.state && <span className={errorTextClassName}>{errors.state}</span>}
      </div>

      <SuggestionField
        label="City / Suburb"
        value={city}
        placeholder={isLoading ? "Loading suburbs..." : "Start typing suburb"}
        disabled={disabled || !normalizedState || isLoading}
        suggestions={suburbSuggestions}
        helperText={suburbHelper}
        errorText={errors?.city}
        fieldGroupClassName={fieldGroupClassName}
        labelClassName={labelClassName}
        inputClassName={cityInputClassName}
        errorTextClassName={errorTextClassName}
        hintTextClassName={hintTextClassName}
        requiredMarkClassName={requiredMarkClassName}
        onChange={onCityChange}
        onSelect={(value) => onCityChange(value)}
      />

      <SuggestionField
        label={ui?.postcodeLabel ?? "Postal Code"}
        value={postalCode}
        placeholder="Postcode"
        disabled={disabled || !normalizedState || isLoading}
        suggestions={postcodeSuggestions}
        helperText={city.trim() ? "Postcode suggestions are narrowed to the selected suburb when possible." : "You can also type the postcode first to narrow the suburb."}
        errorText={errors?.postalCode}
        inputMode="numeric"
        fieldGroupClassName={fieldGroupClassName}
        labelClassName={labelClassName}
        inputClassName={postcodeInputClassName}
        errorTextClassName={errorTextClassName}
        hintTextClassName={hintTextClassName}
        requiredMarkClassName={requiredMarkClassName}
        onChange={(value) => onPostalCodeChange(value.replace(/[^0-9]/g, "").slice(0, 4))}
        onSelect={(value) => onPostalCodeChange(value)}
      />
    </>
  );
}
