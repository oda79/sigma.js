import { NodeBorderProgramOptions } from "./utils";

export default function getFragmentShader({ borderColor, borderSize }: NodeBorderProgramOptions) {
  // language=GLSL
  const SHADER = /*glsl*/ `
precision highp float;

varying vec2 v_diffVector;
varying float v_radius;
varying vec4 v_texture;
varying float v_opacity;

uniform sampler2D u_atlas;
uniform float u_correctionRatio;
uniform float u_cameraAngle;

#ifdef PICKING_MODE
varying vec4 v_color;
#else
varying float v_borderSize;
// For normal mode, we use the border colors defined in the program:
${"attribute" in borderSize ? `varying float v_borderSize;\n` : ``}
${"attribute" in borderColor ? `varying vec4 v_borderColor;\n` 
      : "value" in borderColor
      ? `uniform vec4 u_borderColor;\n`
      : ``}
#endif

const float bias = 255.0 / 254.0;
const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
const float v_imageBorderWidth = 0.04; // Tiny border of texture (in-between texture and border) to antialias it's edge

void main(void) {
  float border = 2.0 * u_correctionRatio;
  float dist = length(v_diffVector);
  vec4 color = gl_FragColor;

  float c = cos(-u_cameraAngle);
  float s = sin(-u_cameraAngle);
  vec2 diffVector = mat2(c, s, -s, c) * (v_diffVector);

  // No antialiasing for picking mode:
  #ifdef PICKING_MODE
  border = 0.0;
  color = v_color;

  if (dist > v_radius)
    gl_FragColor = transparent;
  else {
    gl_FragColor = v_color;
    gl_FragColor.a *= bias;
  }  

  #else
    bool insideRadius = dist < v_radius;
    bool insideBorder = dist < v_radius - v_borderSize;
    bool withinaAntialiasBorder =  insideRadius && dist > v_radius - v_borderSize - v_imageBorderWidth;

  if (insideBorder) {
    // In case no image, use color
    vec4 color = v_color;
    // Draw texture
    if (v_texture.w > 0.0) {
        vec4 texel = texture2D(u_atlas, v_texture.xy + diffVector * v_texture.zw, -1.0);
        color = vec4(mix(v_color.rgb, texel.rgb, texel.a), max(texel.a, v_color.a));
    }
    if (withinaAntialiasBorder) {
        float smoothBorder = (radius - dist - v_borderSize) / v_imageBorderWidth;
        color = mix(v_borderColor, color, smoothBorder);
    }   
    gl_FragColor = mix(blur, color, v_opacity);
  } else {
    gl_FragColor = insideRadius ? mix(transparent, v_borderColor, (radius - dist) / v_borderSize * v_opacity) : transparent;
  }

  }
  #endif
}
`;

  return SHADER;
}
