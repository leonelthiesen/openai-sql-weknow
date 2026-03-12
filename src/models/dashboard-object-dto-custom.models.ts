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
    type?: TComponentType.ctGrid,
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
}
