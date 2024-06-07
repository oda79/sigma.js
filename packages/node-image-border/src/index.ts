import createNodeImageBorderProgram from "./factory";

export { default as createNodeImageBorderProgram } from "./factory";
export const NodeImageBorderProgram = createNodeImageBorderProgram();
export const NodePictogramBorderProgram = createNodeImageBorderProgram({
  keepWithinCircle: true,
  size: { mode: "force", value: 256 },
  drawingMode: "color",
  correctCentering: true  
});
