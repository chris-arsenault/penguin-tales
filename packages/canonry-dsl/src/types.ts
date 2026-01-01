export interface SourceSpan {
  file: string;
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

export interface Diagnostic {
  message: string;
  span?: SourceSpan;
  severity: 'error' | 'warning';
}

export interface IdentifierValue {
  type: 'identifier';
  value: string;
  span: SourceSpan;
}

export interface ArrayValue {
  type: 'array';
  items: Value[];
  span: SourceSpan;
}

export interface ObjectEntry {
  key: string;
  value: Value;
  span: SourceSpan;
}

export interface ObjectValue {
  type: 'object';
  entries: ObjectEntry[];
  span: SourceSpan;
}

export type Value = string | number | boolean | null | IdentifierValue | ArrayValue | ObjectValue;

export interface AttributeNode {
  type: 'attribute';
  key: string;
  value: Value;
  span: SourceSpan;
}

export interface BlockNode {
  type: 'block';
  name: string;
  labels: string[];
  body: StatementNode[];
  span: SourceSpan;
}

export type StatementNode = AttributeNode | BlockNode;

export interface AstFile {
  path: string;
  statements: StatementNode[];
}

export interface CompileResult<TConfig> {
  config: TConfig | null;
  diagnostics: Diagnostic[];
}
