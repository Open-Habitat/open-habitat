import common from "../../../contracts/v1/common.schema.json";
import composerSchema from "../../../contracts/v1/composer.schema.json";
import { LazyAjv } from "./lazyAjv";

// The composer's host messages are checked against the published contract at
// the boundary; nothing from the host is trusted before that.
const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
ajv.addSchema(composerSchema);
const def = (name: string) =>
  ajv.compile({ $ref: `${composerSchema.$id}#/$defs/${name}` });

export const validStartPageReply = def("startPageReply");
export const validCommandList = def("commandList");
export const validFileList = def("fileList");
export const validFilePreview = def("filePreview");
export const validBashReply = def("bashReply");
export const validBashStatus = def("bashStatus");
