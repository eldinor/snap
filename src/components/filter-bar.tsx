import type { ReactNode } from "react";

interface FilterChipOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectConfig<T extends string> {
  label: string;
  value: T;
  options: FilterSelectOption<T>[];
  onChange: (value: T) => void;
}

interface FilterBarProps<
  TChip extends string = never,
  TSelect extends string = never,
> {
  className?: string;
  searchActions?: ReactNode;
  hideSearch?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchId: string;
  chips?: {
    selectedValue: TChip;
    options: FilterChipOption<TChip>[];
    onChange: (value: TChip) => void;
  };
  selects?: Array<FilterSelectConfig<TSelect>>;
}

export function FilterBar<TChip extends string = never, TSelect extends string = never>(
  props: FilterBarProps<TChip, TSelect>,
) {
  const className = props.className ? `filter-bar ${props.className}` : "filter-bar";
  return (
    <div className={className}>
      {!props.hideSearch || props.searchActions ? (
        <div className="filter-bar-search-row">
          {props.hideSearch ? <div className="filter-bar-search-spacer" aria-hidden="true"></div> : null}
          {!props.hideSearch ? (
            <input
              id={props.searchId}
              className="editor-input filter-bar-search"
              type="text"
              title=""
              placeholder={props.searchPlaceholder}
              value={props.searchValue}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
            />
          ) : null}
          {props.searchActions ? <div className="filter-bar-actions">{props.searchActions}</div> : null}
        </div>
      ) : null}
      {props.chips ? (
        <div className="chip-row">
          {props.chips.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip${props.chips?.selectedValue === option.value ? " is-active" : ""}`}
              onClick={() => {
                props.chips?.onChange(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {props.selects?.length ? (
        <div className="filter-select-row">
          {props.selects.map((select) => (
            <label key={select.label} className="filter-select">
              <span>{select.label}</span>
              <select
                className="editor-input"
                title=""
                value={select.value}
                onChange={(event) => {
                  select.onChange(event.target.value as TSelect);
                }}
              >
                {select.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
