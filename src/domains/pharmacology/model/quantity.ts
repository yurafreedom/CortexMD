export const QUANTITY_UNITS = [
  'mg',
  'mg/kg',
  'tablet',
  'component',
  'IU',
  'nM',
  'hour',
  'g/mol',
  'ratio',
  'percent',
] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export interface Quantity<Unit extends QuantityUnit = QuantityUnit> {
  readonly value: number;
  readonly unit: Unit;
}
