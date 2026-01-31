export interface TreeViewField {
  isField: boolean;
  completeName: string;
  items?: TreeViewField[];
  [key: string]: any;
}

export interface ListField extends Omit<TreeViewField, 'items'> {
  isField: boolean;
  completeName: string;
}

export function convertTreeViewInList(treeView: TreeViewField[]): ListField[] {
  let tempFieldList: ListField[] = [];
  treeView.forEach((field) => {
    if (field.isField) {
      const listField = { ...field };
      delete listField.items;
      tempFieldList.push(listField as ListField);
    }
    if (field.items) {
      const tempChildFields = convertTreeViewInList(field.items);
      tempFieldList = tempFieldList.concat(tempChildFields);
    }
  });
  return tempFieldList;
}
