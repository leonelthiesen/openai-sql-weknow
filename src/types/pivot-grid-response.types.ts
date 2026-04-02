export type RowKey = `d${number}`;

export type PivotGridCellRawValue = string;
export type PivotGridCellValue = string | number | boolean | null;

export interface RawPivotGridRow {
  [key: RowKey]: PivotGridCellRawValue;
}

export interface PivotGridRow {
  [key: RowKey]: PivotGridCellValue;
}

export interface PivotGridColumnHeader {
  caption: string;
}

export interface PivotGridFormatOptions {
  format: number;
  showThousandSeparator: boolean;
  thousandSeparator: string;
  decimalSeparator: string;
  decimals: number;
}

export interface PivotGridColumn {
  completeName: string;
  dataType: number;
  section: number;
  header: PivotGridColumnHeader;
  expanded: boolean;
  wordWrap: boolean;
  visible: boolean;
  dataVisibility?: number;
  formatOptions?: PivotGridFormatOptions;
}

export interface PivotGridTotalNode {
  displayValue: string;
  internalValues: number[];
  displayValues: string[];
  formattings: number[];
  valueFormattings: number[];
}

export interface PivotGridColumnTotal extends PivotGridTotalNode {
  [key: `r.${string}`]: PivotGridTotalNode;
}

export interface PivotGridTotals {
  internalValues: number[];
  displayValues: string[];
  formattings: number[];
  valueFormattings: number[];
  [key: `c.${string}`]: PivotGridColumnTotal;
  [key: `r.${string}`]: PivotGridTotalNode;
}

export interface PivotGridFormatting {
  fontColor: string;
  fontName: string;
  fontSize: number;
  bold: boolean;
  alignmentH: number;
}

export interface PivotGridValueFormatting {
  format: number;
  showThousandSeparator: boolean;
  thousandSeparator: string;
  decimalSeparator: string;
  decimals: number;
}

export interface PivotGridMetaValue {
  completeName?: string;
  title: string;
  linkName: string;
  autoLink?: boolean;
  isSelectionId?: boolean;
}

export interface PivotGridDataInfo {
  source: number;
  dateTime: string;
}

export interface PivotGridServerInfo {
  version: string;
}

interface PivotGridResponseBase<TRow> {
  rows: TRow[];
  cols: PivotGridColumn[];
  totals: PivotGridTotals;
  formattings: PivotGridFormatting[];
  valueFormattings: PivotGridValueFormatting[];
  showRecordCount: boolean;
  showRowTitle: boolean;
  showColumnTitle: boolean;
  showDataTitle: boolean;
  metaValues: PivotGridMetaValue[];
  dataInfo: PivotGridDataInfo;
  showSubtotalColumn: boolean;
  showSubtotalRow: boolean;
  showGrandTotalColumn: boolean;
  showGrandTotalRow: boolean;
  serverInfo: PivotGridServerInfo;
}

export type RawPivotGridResponse = PivotGridResponseBase<RawPivotGridRow>;
export type PivotGridResponse = PivotGridResponseBase<PivotGridRow>;
