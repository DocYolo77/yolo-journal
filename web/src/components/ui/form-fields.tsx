import type { ReactNode } from "react";

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function FieldWrapper({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-negative"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-negative">{error}</p> : null}
    </div>
  );
}

type BaseFieldProps = {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  defaultValue?: string;
  /** Ghost hint text shown inside the empty field. */
  placeholder?: string;
};

export function FieldText({ name, label, defaultValue, error, required, placeholder }: BaseFieldProps) {
  return (
    <FieldWrapper label={label} htmlFor={name} error={error} required={required}>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
      />
    </FieldWrapper>
  );
}

export function FieldTextarea({ name, label, defaultValue, error, required, placeholder }: BaseFieldProps) {
  return (
    <FieldWrapper label={label} htmlFor={name} error={error} required={required}>
      <textarea
        id={name}
        name={name}
        rows={4}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
      />
    </FieldWrapper>
  );
}

export function FieldNumber({
  name,
  label,
  defaultValue,
  error,
  required,
  min,
  placeholder,
}: BaseFieldProps & { min?: number }) {
  return (
    <FieldWrapper label={label} htmlFor={name} error={error} required={required}>
      <input
        id={name}
        name={name}
        type="number"
        step="any"
        min={min}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
      />
    </FieldWrapper>
  );
}

export function FieldDateTime({ name, label, defaultValue, error, required }: BaseFieldProps) {
  return (
    <FieldWrapper label={label} htmlFor={name} error={error} required={required}>
      <input
        id={name}
        name={name}
        type="datetime-local"
        defaultValue={defaultValue}
        className={inputClass}
      />
    </FieldWrapper>
  );
}

export function FieldSelect({
  name,
  label,
  defaultValue,
  error,
  required,
  options,
  placeholder,
}: BaseFieldProps & {
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <FieldWrapper label={label} htmlFor={name} error={error} required={required}>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
