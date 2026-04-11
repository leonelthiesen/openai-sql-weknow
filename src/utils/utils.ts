import crypto from "crypto";


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

export function encryptWithPublicKey (plainText: string, publicKeyPem: string) {
    // Normalizar a chave PEM: remover espaços extras e padronizar quebras de linha
    const normalizedKey = publicKeyPem
        .trim()
        .replace(/\r\n/g, '\n');  // Converter Windows CRLF para LF

    const buffer = Buffer.from(plainText, 'utf8');

    const encrypted = crypto.publicEncrypt(
        {
            key: normalizedKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        },
        buffer
    );
    return encrypted.toString('base64');
}
