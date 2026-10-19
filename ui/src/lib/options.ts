export type PickerOption = { value: string; label: string; title?: string }
export type PickerGroup = { label?: string; options: PickerOption[] }

/** One ungrouped list where each value is its own label. */
export const options = (values: string[]): PickerGroup[] => [{ options: values.map((v) => ({ value: v, label: v })) }]
