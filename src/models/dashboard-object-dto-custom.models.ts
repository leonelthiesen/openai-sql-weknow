import { TBooleanOperator } from "./TBooleanOperator";
import { TChartAxisMax } from "./TChartAxisMax";
import { TChartAxisMin } from "./TChartAxisMin";
import { TChartLegendPosition } from "./TChartLegendPosition";
import { TChartLegendSelectionMode } from "./TChartLegendSelectionMode";
import { TChartStackType } from "./TChartStackType";
import { TChartType } from "./TChartType";
import { TChartValueVisibility } from "./TChartValueVisibility";
import { TColorSelector_Mode } from "./TColorSelector_Mode";
import { TComparisonOperator } from "./TComparisonOperator";
import { TComponentType } from "./TComponentType";
import { TFieldType } from "./TFieldType";
import { TGridBaseType } from "./TGridBaseType";
import { TMeasureFunction } from "./TMeasureFunction";
import { TSortDirection } from "./TSortDirection";
import { TTextAlignmentH } from "./TTextAlignmentH";

export enum TCustomFilterValueMode {
  fvmNull,
  fvmFixed
}

export interface TCustomHavingFilter {
  completeName?: string,
  filters?: TCustomHavingFilter[],
  join?: TBooleanOperator,
  linkName?: string,
  measureFunction?: TMeasureFunction,
  not?: boolean,
  operator?: TComparisonOperator,
  values?: {
    fixedValues?: any[],
    mode?: TCustomFilterValueMode,
    values?: any,
  }
}

export interface TCustomPosWindowFunctionFilter {
  completeName?: string,
  filters?: TCustomPosWindowFunctionFilter[],
  join?: TBooleanOperator,
  linkName?: string,
  measureFunction?: TMeasureFunction,
  not?: boolean,
  operator?: TComparisonOperator,
  values?: {
    fixedValues?: any[],
    mode?: TCustomFilterValueMode,
    values?: any,
  }
}

export interface TCustomWhereFilter {
  completeName?: string,
  filters?: TCustomWhereFilter[],
  ignoreIfNull?: boolean,
  join?: TBooleanOperator,
  linkName?: string,
//   metaDataFieldType?: TMetaDataFieldType,
  not?: boolean,
  operator?: TComparisonOperator,
//   sanitizeSearch?: boolean,
//   trueIfValueIsNull?: boolean,
  values?: {
    // connectionId?: number,
    // fieldName1?: string,
    // fieldName2?: string,
    fixedValues?: any[],
    // formula1?: string,
    // formula2?: string,
    mode?: TCustomFilterValueMode,
    // sql?: string,
    // [Deprecated]
    values?: any,
    // variables?: {
    //   name?: string,
    //   value?: any
    // }[],
  }
}

interface TComponentGridView {
  gridBaseType: TGridBaseType.gbtSingleDimension,
  columns?: {
    completeName?: string,
    distinct?: boolean,
    distinctCompleteName?: string,
    measureFunction?: TMeasureFunction,
    alignmentH?: TTextAlignmentH,
    title?: string
  }[],
  sort?: {
    completeName?: string,
    direction?: TSortDirection,
    measureFunction?: TMeasureFunction
  }[],
  cols?: {
    completeName?: string,
    title?: string
  }[],
  rows?: {
    completeName?: string,
    title?: string
  }[],
  measures?: {
    completeName?: string,
    measureFunction?: TMeasureFunction,
    title?: string,
  }[],
  colSort?: {
    completeName?: string,
    direction?: TSortDirection,
    measureFunction?: TMeasureFunction
  }[],
  rowSort?: {
    completeName?: string,
    direction?: TSortDirection,
    measureFunction?: TMeasureFunction
  }[],
  distinct?: boolean, // Inserido para uso nos testes automatizados
  havingFilters?: TCustomHavingFilter,
}

interface TComponentChartView {
  '3d'?: boolean,
  axis?: {
    bottom?: TChartCustomAxis,
    left?: TChartCustomAxis,
    right?: TChartCustomAxis,
    top?: TChartCustomAxis
  },
  baseSerieType?: TChartType,
  calculateLabelsOnBackwardAndForward?: boolean,
  defaultSerie?: {
    axisHIndex?: number,
    axisVIndex?: number,
    color?: {
      fixed?: string,
      formulaIgnoreOpacity?: boolean,
      list?: {
        color?: string,
        text?: string
      }[],
      listColorEachPoint?: boolean,
      mode?: TColorSelector_Mode,
    },
    hintText?: string,
    legendText?: string,
    lineBorderSize?: number,
    spline?: boolean,
    stackGroup?: number,
    values?: {
      inside?: boolean,
      showFrame?: boolean,
      showSymbol?: boolean,
      text?: string,
      visible?: TChartValueVisibility
    }
  },
  groups?: {
    completeName?: string,
    title?: string
  }[],
  havingFilters?: TCustomHavingFilter,
  labelLimit?: {
    additionalText?: string,
    count?: number,
    showAdditional?: boolean
  },
  labels?: {
    completeName?: string,
    title?: string
  }[],
  legend?: {
    itemText?: string,
    position?: TChartLegendPosition,
    selectionMode?: TChartLegendSelectionMode,
    title?: string,
    visible?: boolean
  },
  maxSize?: number,
  selection?: {
    allowMultiple?: boolean,
    color?: string,
    visible?: boolean
  },
  serieLimit?: {
    additionalText?: string,
    count?: number,
    showAdditional?: boolean
  },
  sort?: {
    completeName?: string,
    direction?: TSortDirection,
    measureFunction?: TMeasureFunction
  }[],
  stackType?: TChartStackType,
  toPairDataAxis?: boolean,
  values?: {
    completeName?: string,
    measureFunction?: TMeasureFunction,
    axisHIndex?: number,
    axisVIndex?: number,
    color?: {
      fixed?: string,
      list?: {
        color?: string,
        text?: string
      }[],
      listColorEachPoint?: boolean,
      mode?: TColorSelector_Mode,
    },
    hintText?: string,
    legendText?: string,
    stackGroup?: number,
    values?: {
      inside?: boolean,
      showFrame?: boolean,
      showSymbol?: boolean,
      text?: string,
      visible?: TChartValueVisibility
    },
    title?: string,
    type?: TChartType,
    spline?: boolean
  }[],
  xaxis?: {
    completeName?: string,
    measureFunction?: TMeasureFunction,
    title?: string
  }[],
  yaxis?: {
    completeName?: string,
    measureFunction?: TMeasureFunction,
    title?: string
  }[]
}

export interface TComponentApi_TExecuteInputCustom {
  accessToken?: string,
  contents?: {
    calculatedFields?: {
      completeName?: string,
      dataType?: TFieldType,
      formula?: string,
      hasAggregateFunction?: boolean,
      hasAnalyticFunction?: boolean,
      title?: string,
    }[],
    dataSource?: {
      metadataId?: number,
      metadataFilterOverride?: {
        linkName?: string,
        values?: {
          fixedValues?: any[],
          mode?: 1,  // fvmFixed
        }
      }[],
    },
    version?: string,
    type?: TComponentType.ctGrid | TComponentType.ctChart,
    whereFilters?: TCustomWhereFilter,
    gridView?: TComponentGridView,
    chartViews?: TComponentChartView[],
  },
  recsMax?: number,
}

interface TComponentPivotGridView {
  gridBaseType: TGridBaseType.gbtMultiDimension,
  cols?: {
    completeName?: string,
    title?: string
  }[],
  rows?: {
    completeName?: string,
    title?: string
  }[],
  measures?: {
    completeName?: string,
    measureFunction?: TMeasureFunction,
    title?: string,
  }[],
  colSort?: {
    completeName?: string,
    direction?: TSortDirection,
    measureFunction?: TMeasureFunction
  }[],
  rowSort?: {
    completeName?: string,
    direction?: TSortDirection,
    measureFunction?: TMeasureFunction
  }[],
  distinct?: boolean, // Inserido para uso nos testes automatizados
  havingFilters?: TCustomHavingFilter,
}

export interface TComponentApi_TExecutePivotTableCustomInput {
  accessToken?: string,
  contents?: {
    calculatedFields?: {
      completeName?: string,
      dataType?: TFieldType,
      formula?: string,
      hasAggregateFunction?: boolean,
      hasAnalyticFunction?: boolean,
      title?: string,
    }[],
    dataSource?: {
      metadataId?: number,
      metadataFilterOverride?: {
        linkName?: string,
        values?: {
          fixedValues?: any[],
          mode?: 1,  // fvmFixed
        }
      }[],
    },
    version?: string,
    type?: TComponentType.ctGrid,
    whereFilters?: TCustomWhereFilter,
    gridView?: TComponentPivotGridView,
  },
  recsMax?: number,
}



interface TChartCustomAxis {
  max?: number,
  maxMode?: TChartAxisMax,
  min?: number,
  minMode?: TChartAxisMin,
  scroll?: boolean,
  showLines?: boolean,
  title?: string,
  visible?: boolean
}
