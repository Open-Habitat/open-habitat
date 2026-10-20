import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import common from "../../../contracts/v1/common.schema.json";
import composerSchema from "../../../contracts/v1/composer.schema.json";

// The composer's host messages are checked against the published contract at
// the boundary; nothing from the host is trusted before that.
const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(common);
ajv.addSchema(composerSchema);
const def = (name: string) =>
  ajv.compile({ $ref: `${composerSchema.$id}#/$defs/${name}` });

export const validCommandList = def("commandList");
export const validFileList = def("fileList");
export const validFilePreview = def("filePreview");
export const validBashReply = def("bashReply");
export const validBashStatus = def("bashStatus");
