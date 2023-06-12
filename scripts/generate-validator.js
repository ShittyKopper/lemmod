/* eslint-disable */

import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { writeFileSync } from "fs";
import schema from "../src/script/schema.json" assert { type: "json" };


const ajv = new Ajv({ strict: true, code: { esm: true, source: true } });
const compiled = ajv.compile(schema);
const code = standaloneCode(ajv, compiled);

writeFileSync("./src/script/validate.js", code);
