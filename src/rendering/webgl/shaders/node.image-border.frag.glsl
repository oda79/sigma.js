precision mediump float;

varying vec4 v_color;
varying float v_border;
varying vec4 v_texture;
varying vec4 v_borderColor;
varying float v_opacity;
uniform sampler2D u_atlas;
const float radius = 0.5;
const float v_imageBorderWidth = 0.04; // Border of texture to antialias it's edge
const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 blur = vec4(0.14, 0.16, 0.18, 1.0);

void main(void) {
  vec2 m = gl_PointCoord - vec2(0.5, 0.5);
  float dist = length(m);
  bool insideRadius = dist < radius;
  bool insideBorder = dist < radius - v_border;
  bool withinaAntialiasBorder =  insideRadius && dist > radius - v_border - v_imageBorderWidth;

  if (insideBorder) {
    vec4 color = v_color;
    // Draw texture
    if (v_texture.w > 0.0) {
        vec4 texel = texture2D(u_atlas, v_texture.xy + gl_PointCoord * v_texture.zw, -1.0);
        color = vec4(mix(v_color.rgb, texel.rgb, texel.a), max(texel.a, v_color.a));
    }
    if (withinaAntialiasBorder) {
        float smoothBorder = (radius - dist - v_border) / v_imageBorderWidth;
        color = mix(v_borderColor, color, smoothBorder);
    }   
    gl_FragColor = mix(blur, color, v_opacity);
  } else {
    gl_FragColor = insideRadius ? mix(transparent, v_borderColor, (radius - dist) / v_border * v_opacity) : transparent;
  }
}