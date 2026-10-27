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
  readOnly = false,
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
  readOnly?: boolean;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => {if(!readOnly)onChange(e.target.value);}}
        list={list?.length ? id : undefined}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
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
  readOnly = false,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        onMouseDown={e=>{if(readOnly)e.preventDefault();}}
        onKeyDown={e=>{if(readOnly&&e.key!=="Tab")e.preventDefault();}}
        aria-label={label}
        value={value}
        onChange={(e) => {if(!readOnly)onChange(e.target.value);}}
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
