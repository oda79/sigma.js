import { CreateNodeBorderProgramOptions } from "./utils";

export default function getVertexShader({ border }: CreateNodeBorderProgramOptions) {
  // language=GLSL
  const SHADER = /*glsl*/ `
attribute vec4 a_color;
attribute vec4 a_colorAttr;
attribute vec2 a_position;
attribute float a_size;
attribute float a_alpha;
attribute float a_angle;
attribute vec4 a_texture;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;

varying vec4 v_color;
varying vec4 v_colorAttr;
varying vec2 v_diffVector;
varying float v_radius;
varying float v_alpha;
varying vec4 v_texture;

const float bias = 255.0 / 254.0;
const float marginRatio = 1.05;

#ifdef PICKING_MODE
  attribute vec4 a_id;
#else
${(border.size && "attribute" in border.size ? [`attribute float a_borderSize_1;`, `varying float v_borderSize_1;`] : []).join("\n")}
${(border.color && "attribute" in border.color ? [`attribute vec4 a_borderColor_1;`, `varying vec4 v_borderColor_1;`] : []).join("\n")}
#endif

void main() {
  float size = a_size * u_correctionRatio / u_sizeRatio * 4.0;
  vec2 diffVector = size * vec2(cos(a_angle), sin(a_angle));
  vec2 position = a_position + diffVector * marginRatio;
  gl_Position = vec4(
    (u_matrix * vec3(position, 1)).xy,
    0,
    1
  );

  v_diffVector = diffVector;
  v_radius = size / 2.0 / marginRatio;
  v_alpha = a_alpha * 1.0;

  #ifdef PICKING_MODE
    // For picking mode, we use the ID as the color:
    v_color = a_id;
  #else
    // For normal mode, we use the color:
    v_color = a_color;
    v_colorAttr = a_colorAttr;
    ${(border.size && "attribute" in border.size ? [`v_borderSize_1 = a_borderSize_1;`] : []).join("\n")}
    ${(border.color && "attribute" in border.color ? [`v_borderColor_1 = a_borderColor_1;`] : []).join("\n")}

    // Pass the texture coordinates:
    v_texture = a_texture;
  #endif
 
  v_colorAttr.a *= bias;
}
`;
  return SHADER;
}
