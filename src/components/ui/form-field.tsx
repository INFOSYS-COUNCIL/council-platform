import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// 입력칸 공용 부품. 이름표(label), 도움말, 오류 문장을 입력칸과 연결해
// 스크린리더가 함께 읽게 한다. id를 주지 않으면 name을 id로 쓴다.

const CONTROL =
  "min-h-11 w-full rounded-lg border border-border-input bg-surface px-3 py-2 text-base sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 aria-[invalid=true]:border-danger";

type FieldProps = {
  label: string;
  name: string;
  id?: string;
  hint?: string;
  error?: string;
};

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldFrame({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-xs font-normal text-red-700 dark:text-red-400">(필수)</span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-zinc-600 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  id = name,
  hint,
  error,
  className = "",
  ...props
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name">) {
  return (
    <FieldFrame id={id} label={label} required={props.required} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextareaField({
  label,
  name,
  id = name,
  hint,
  error,
  className = "",
  ...props
}: FieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name">) {
  return (
    <FieldFrame id={id} label={label} required={props.required} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}

export type SelectOption = { value: string; label: string; };

export function MultiSelectField({ label, name, options, defaultValue = [], hint, error }: FieldProps & {
  options: readonly SelectOption[];
  defaultValue?: readonly string[];
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={describedBy(name, hint, error)}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border-input bg-surface p-2">
        {options.length === 0 && <p className="p-2 text-sm text-muted">선택할 구성원이 없습니다.</p>}
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <input type="checkbox" name={name} value={option.value} defaultChecked={defaultValue.includes(option.value)} className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-accent" />
            {option.label}
          </label>
        ))}
      </div>
      {hint && <p id={`${name}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${name}-error`} className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}

export function SelectField({
  label,
  name,
  id = name,
  hint,
  error,
  options,
  placeholder,
  className = "",
  ...props
}: FieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "name"> & {
    options: readonly SelectOption[];
    // 첫 줄에 보이는 "선택하세요" 같은 빈 값 항목
    placeholder?: string;
  }) {
  return (
    <FieldFrame id={id} label={label} required={props.required} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL} ${className}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}
