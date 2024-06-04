import { NodeBorderProgramOptions } from "./utils";

export default function getVertexShader({ borderColor, borderSize }: NodeBorderProgramOptions) {
  // language=GLSL
  const SHADER = /*glsl*/ `
attribute vec4 a_color;
attribute vec2 a_position;
attribute float a_size;
attribute float a_angle;
attribute vec4 a_texture;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;

varying vec2 v_diffVector;
varying float v_radius;
varying vec4 v_texture;
varying float v_opacity;
varying vec4 v_color;

#ifdef PICKING_MODE
  attribute vec4 a_id;
#else
  ${"attribute" in borderSize ? `attribute float a_borderSize;\n varying float v_borderSize;\n` : ``}
  ${"attribute" in borderColor ? `attribute vec4 a_borderColor;\n varying vec4 v_borderColor;\n` : ``}
#endif

const float bias = 255.0 / 254.0;
const float marginRatio = 1.05;

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

  #ifdef PICKING_MODE
    // For picking mode, we use the ID as the color:
    v_color = a_id;
  #else
    // For normal mode, we use the color:
    v_color = a_color;
    ${"attribute" in borderSize ? `  v_borderSize = a_borderSize;\n` : ``}
    ${"attribute" in borderColor ? `  v_borderColor = a_borderColor;\n` : ``}  

    // Pass the texture coordinates:
    v_texture = a_texture;
  #endif

  v_color.a *= bias;
  v_opacity = 0.5;
}
`;

  return SHADER;
}
