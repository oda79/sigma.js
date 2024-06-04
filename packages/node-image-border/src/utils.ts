export type NodeBorderSizeMode = "relative" | "pixels";
export const DEFAULT_BORDER_SIZE_MODE: NodeBorderSizeMode = "relative";

export type NodeBorderColor = { value: string } | { attribute: string; defaultValue?: string } | { transparent: true };
export type NodeBorderSize = { value: number; mode?: NodeBorderSizeMode };

export type NodeBorderProgramOptions = {
  borderColor: NodeBorderColor;
  borderSize: NodeBorderSize;
}

export const DEFAULT_NODE_BORDER_OPTIONS: NodeBorderProgramOptions = { 
  borderColor: { value: "#ff0000" },
  borderSize: { value: 0.1 }
};

export const DEFAULT_COLOR = "#000000";
