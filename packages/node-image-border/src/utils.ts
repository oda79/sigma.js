export type NodeBorderSizeMode = "relative" | "pixels";
export const DEFAULT_BORDER_SIZE_MODE: NodeBorderSizeMode = "relative";

export type NodeBorderColor = { value: string } | { attribute: string; defaultValue?: string } | { transparent: true };
export type NodeBorderSize =
  | { value: number; mode?: NodeBorderSizeMode }
  | { attribute: string; defaultValue: number; mode?: NodeBorderSizeMode };

export interface CreateNodeBorderProgramOptions {
  border: {
    color: NodeBorderColor;
    size: NodeBorderSize;
  };
}

export const DEFAULT_CREATE_NODE_BORDER_OPTIONS: CreateNodeBorderProgramOptions = {
  border: { size: { value: 0.1 }, color: { attribute: "borderColor" } }
};

export const DEFAULT_COLOR = "#000000";
