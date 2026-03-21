import { TBooleanOperator } from "./TBooleanOperator";
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
    },
    version?: string,
    type?: TComponentType.ctGrid | TComponentType.ctChart,
    whereFilters?: TCustomWhereFilter,
    gridView?: {
      columns?: {
        completeName?: string,
        distinct?: boolean,
        distinctCompleteName?: string,
        measureFunction?: TMeasureFunction,
        alignmentH?: TTextAlignmentH,
        title?: string
      }[],
      gridBaseType: TGridBaseType.gbtSingleDimension,
      havingFilters?: TCustomHavingFilter,
      posWindowFunctionFilters?: TCustomPosWindowFunctionFilter,
      sort?: {
        completeName?: string,
        direction?: TSortDirection,
        measureFunction?: TMeasureFunction
      }[],
    }
  },
  recsMax?: number,
}

// export interface TComponentApi_TExecuteInput {
//   componentId?: number,
//   contents?: {
//     dataSource?: {
//       metadataFilterOverride?: {
//         linkName?: string,
//         values?: {
//           fixedValues?: any[],
//           mode?: 1,  // fvmFixed
//         }
//       }[],
//       metadataId?: number
//     },
//     chartViews?: {
//       '3d'?: boolean,
//       axis?: {
//         bottom?: {
//           max?: number,
//           maxMode?: TChartAxisMax,
//           min?: number,
//           minMode?: TChartAxisMin,
//           scroll?: boolean,
//           showLines?: boolean,
//           title?: string,
//           visible?: boolean
//         },
//         left?: {
//           max?: number,
//           maxMode?: TChartAxisMax,
//           min?: number,
//           minMode?: TChartAxisMin,
//           scroll?: boolean,
//           showLines?: boolean,
//           title?: string,
//           visible?: boolean
//         },
//         right?: {
//           max?: number,
//           maxMode?: TChartAxisMax,
//           min?: number,
//           minMode?: TChartAxisMin,
//           scroll?: boolean,
//           showLines?: boolean,
//           title?: string,
//           visible?: boolean
//         },
//         top?: {
//           max?: number,
//           maxMode?: TChartAxisMax,
//           min?: number,
//           minMode?: TChartAxisMin,
//           scroll?: boolean,
//           showLines?: boolean,
//           textOrientation?: TChartAxisTextOrientation,
//           title?: string,
//           visible?: boolean
//         }
//       },
//       baseSerieType?: TChartType,
//       calculateLabelsOnBackwardAndForward?: boolean,
//       defaultSerie?: {
//         axisHIndex?: number,
//         axisVIndex?: number,
//         color?: {
//           fixed?: string,
//           formulaIgnoreOpacity?: boolean,
//           list?: {
//             color?: string,
//             text?: string
//           }[],
//           listColorEachPoint?: boolean,
//           mode?: TColorSelector_Mode,
//           rules?: {
//             color?: string,
//             operator?: TScaleNumberOperator,
//             text?: string,
//             value?: number,
//             valueUnit?: TColorSelector_ScaleItem_ValueUnit,
//             variable?: number
//           }[],
//           scale?: {
//             color?: string,
//             text?: string,
//             value?: number,
//             valueUnit?: TColorSelector_ScaleItem_ValueUnit
//           }[],
//           scaleMode?: TColorSelector_ScaleMode,
//           scaleVariable?: number
//         },
//         hintText?: string,
//         legendText?: string,
//         lineBorderSize?: number,
//         spline?: boolean,
//         stackGroup?: number,
//         values?: {
//           inside?: boolean,
//           orientation?: TChartValueOrientation,
//           showFrame?: boolean,
//           showSymbol?: boolean,
//           text?: string,
//           visible?: TChartValueVisibility
//         }
//       },
//       groups?: {
//         completeName?: string,
//         title?: string
//       }[],
//       havingFilters?: THavingFilter,
//       labelLimit?: {
//         additionalText?: string,
//         count?: number,
//         showAdditional?: boolean
//       },
//       labels?: {
//         completeName?: string,
//         title?: string
//       }[],
//       legend?: {
//         itemText?: string,
//         position?: TChartLegendPosition,
//         selectionMode?: TChartLegendSelectionMode,
//         showFrame?: boolean,
//         showSymbol?: boolean,
//         style?: TChartLegendStyle,
//         symbolPosition?: TChartLegendSymbolPosition,
//         title?: string,
//         visible?: boolean
//       },
//       maxSize?: number,
//       selection?: {
//         allowMultiple?: boolean,
//         color?: string,
//         visible?: boolean
//       },
//       serieLimit?: {
//         additionalText?: string,
//         count?: number,
//         showAdditional?: boolean
//       },
//       sort?: {
//         completeName?: string,
//         direction?: TSortDirection,
//         measureFunction?: TMeasureFunction
//       }[],
//       stackType?: TChartStackType,
//       toPairDataAxis?: boolean,
//       values?: {
//         completeName?: string,
//         measureFunction?: TMeasureFunction,
//         axisHIndex?: number,
//         axisVIndex?: number,
//         color?: {
//           fixed?: string,
//           list?: {
//             color?: string,
//             text?: string
//           }[],
//           listColorEachPoint?: boolean,
//           mode?: TColorSelector_Mode,
//         },
//         hintText?: string,
//         legendText?: string,
//         stackGroup?: number,
//         values?: {
//           inside?: boolean,
//           orientation?: TChartValueOrientation,
//           showFrame?: boolean,
//           showSymbol?: boolean,
//           text?: string,
//           visible?: TChartValueVisibility
//         },
//         title?: string,
//         type?: TChartType,
//         spline?: boolean
//       }[],
//       xaxis?: {
//         completeName?: string,
//         measureFunction?: TMeasureFunction,
//         title?: string
//       }[],
//       yaxis?: {
//         completeName?: string,
//         measureFunction?: TMeasureFunction,
//         title?: string
//       }[]
//     }[]
//   },
//   metadataFilterOverride?: {
//     linkName?: string,
//     values?: {
//       fixedValues?: any[],
//       mode?: TFilterValueMode,
//     }
//   },
//   userViewId?: number,
//   viewId?: string
// }
