import { numberToGLSLFloat } from "sigma/rendering";
import { CreateNodeBorderProgramOptions, DEFAULT_BORDER_SIZE_MODE } from "./utils";

export default function getFragmentShader({ border }: CreateNodeBorderProgramOptions) {
  // language=GLSL
  const SHADER = /*glsl*/ `
precision highp float;

varying vec4 v_color;
varying vec4 v_colorAttr;
varying vec2 v_diffVector;
varying float v_radius;
varying float v_alpha;
varying vec4 v_texture;

uniform sampler2D u_atlas;
uniform float u_correctionRatio;
uniform float u_cameraAngle;
uniform float u_percentagePadding;
uniform bool u_colorizeImages;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
const float alpha = 0.5;

const float radius = 0.5;

#ifdef PICKING_MODE
#else
  // For normal mode, we use the border colors defined in the program:
  ${(border.size && "attribute" in border.size
    ? `varying float v_borderSize_1;`
    : ``)}
  ${(border.color && "attribute" in border.color
    ? `varying vec4 v_borderColor_1;`
    : "value" in border.color
      ? `uniform vec4 u_borderColor_1;`
      : ``)}    
#endif

const float bias = 255.0 / 254.0;

void main(void) {
  float border = 2.0 * u_correctionRatio;
  float v_borderSize_0 = v_radius;
  vec4 v_borderColor_0 = transparent;  
  float dist = length(v_diffVector);
  vec4 color = gl_FragColor;

  float c = cos(-u_cameraAngle);
  float s = sin(-u_cameraAngle);
  vec2 diffVector = mat2(c, s, -s, c) * (v_diffVector);

  // No antialiasing for picking mode:
  #ifdef PICKING_MODE
    if (dist > v_borderSize_0)
      gl_FragColor = transparent;
    else {
      gl_FragColor = v_color;
    }
  #else
    // Sizes:
    ${`float borderSize_1 = ${(border.size.mode || DEFAULT_BORDER_SIZE_MODE) === "pixels" ? "u_correctionRatio" : "v_radius"} * ${border.size && "attribute" in border.size ? `v_borderSize_1` : numberToGLSLFloat(border.size.value)};`}  

    // Normalize all border size, to start from the full size
    // Basically, here we have adjustedBorderSize_0 as an outer edge of our border
    // and adjustedBorderSize_1 as inner edge of it
    float adjustedBorderSize_0 = v_radius;
    float adjustedBorderSize_1 = adjustedBorderSize_0 - borderSize_1;

    // Colors:
    vec4 borderColor_0 = transparent;
    ${border.color && "attribute" in border.color
      ? `vec4 borderColor_1 = v_borderColor_1;`
      : "transparent" in border.color
        ? `vec4 borderColor_1 = vec4(0.0, 0.0, 0.0, 0.0);`
        : `vec4 borderColor_1 = u_borderColor_1;`
    }    
    borderColor_1.a *= bias;
    
    // If no border or it is very tiny, ignore it and make transparent
    if (borderSize_1 <= 1.0 * u_correctionRatio) { borderColor_1 = borderColor_0; }

    // First case: No image to display
    if (v_texture.w <= 0.0) {
      if (!u_colorizeImages) {
        color = v_color;
      }
    }
    // Second case: Image loaded into the texture
    else {
      float paddingRatio = 1.0 + 2.0 * u_percentagePadding;
      float coef = 1.0;
      vec2 coordinateInTexture = diffVector * vec2(paddingRatio, -paddingRatio) / v_radius / 2.0 * coef + vec2(0.5, 0.5);
      vec4 texel = texture2D(u_atlas, (v_texture.xy + coordinateInTexture * v_texture.zw), -1.0);

      // Colorize all visible image pixels:
      if (u_colorizeImages) {
        color = mix(v_color, mix(texel, v_colorAttr,  texel.a), texel.a);      
      }
      // Colorize background pixels, keep image pixel colors:
      else {
        color = vec4(mix(v_color, texel, texel.a).rgb, max(texel.a, v_color.a));
      }

      // Erase pixels "in the padding":
      if (abs(diffVector.x) > v_radius / paddingRatio || abs(diffVector.y) > v_radius / paddingRatio) {
        //color = u_colorizeImages ? gl_FragColor : v_color;
        color = v_color;
      }
    }

    // Draw border on top of the image or colored circle if no image provided
    if (dist > adjustedBorderSize_0) {
      gl_FragColor = borderColor_0;
    } else if (dist > adjustedBorderSize_0 - border) {
        if (borderColor_1 == borderColor_0)
          // Add some antialiasing for the image is there is no border at ll or it is transparent
          gl_FragColor = mix(color, borderColor_0, (dist - adjustedBorderSize_0 + border) / border);
        else
          // Add some antialiasing to the outer edge of the border
          gl_FragColor = mix(borderColor_1, borderColor_0, (dist - adjustedBorderSize_0 + border) / border);
    } else if (dist > adjustedBorderSize_1) {
      gl_FragColor = borderColor_1;
    } else if (dist > adjustedBorderSize_1 - border)
      // Add some antialiasing to the inner edge of the border
      gl_FragColor = mix(color,  borderColor_1, (dist - adjustedBorderSize_1 + border) / border);
	  else {
      gl_FragColor = color;
    }
    // Set alpha
    gl_FragColor.a *= v_alpha;
     
  #endif      
}
`;

  return SHADER;
}
