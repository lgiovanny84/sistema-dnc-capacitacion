export function Input({
  label,
  value,
  onChange,
  type = "text",
  list,
  min,
  max,
  step,
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  list?: string[];
  min?: string;
  max?: string;
  step?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={list?.length ? id : undefined}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {list?.length ? (
        <datalist id={id}>
          {list.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </datalist>
      ) : null}
    </label>
  );
}
export function Select({
  label,
  value,
  values,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">Seleccione…</option>
        {values.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}
