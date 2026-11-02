import Ajv, {
  type AnySchema,
  type Options,
  type Schema,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export type Validator<T = unknown> = (data: unknown) => data is T;

/** An Ajv instance that compiles nothing until a validator is first called.
 *
 * The contract modules used to compile their validators when they loaded, and
 * the bundle loads about forty of them: Ajv's code generation then took most
 * of every page load (5–8 s on an 8-core arm64 host, 2.11.2026), before the
 * app made its first request. A page uses only a few of them, so each module
 * keeps its own schemas and options, but the real Ajv is built and the schema
 * compiled on first use. Every validator still checks exactly what it did. */
export class LazyAjv {
  #options: Options;
  #addFormats: boolean;
  #schemas: AnySchema[] = [];
  #ajv: Ajv | undefined;

  /** `addFormats` applies ajv-formats, as `addFormats(new Ajv(...))` did. */
  constructor(options: Options & { addFormats?: boolean } = {}) {
    const { addFormats: formats = false, ...rest } = options;
    this.#options = rest;
    this.#addFormats = formats;
  }

  /** Registers a schema for $ref resolution; all registrations precede the
   * first validation, as they did when compiling at load. */
  addSchema(schema: AnySchema): this {
    if (this.#ajv) this.#ajv.addSchema(schema);
    else this.#schemas.push(schema);
    return this;
  }

  compile<T = unknown>(schema: Schema): Validator<T> {
    return lazy(() => this.#instance().compile<T>(schema));
  }

  /** A registered schema by $id or JSON pointer; a missing one is a
   * programming error and throws on first use. */
  getSchema<T = unknown>(ref: string): Validator<T> {
    return lazy(() => {
      const validate = this.#instance().getSchema<T>(ref);
      if (!validate) throw new Error(`missing contract ${ref}`);
      return validate;
    });
  }

  #instance(): Ajv {
    if (!this.#ajv) {
      const ajv = new Ajv(this.#options);
      if (this.#addFormats) addFormats(ajv);
      for (const schema of this.#schemas) ajv.addSchema(schema);
      this.#schemas = [];
      this.#ajv = ajv;
    }
    return this.#ajv;
  }
}

function lazy<T>(compile: () => (data: unknown) => boolean): Validator<T> {
  let validate: ((data: unknown) => boolean) | undefined;
  return (data: unknown): data is T => {
    validate ??= compile();
    return validate(data);
  };
}
