precision mediump float;

varying vec4 v_color;
varying float v_border;
varying vec4 v_texture;
varying vec4 v_borderColor; // Change v_borderColor from uniform to varying
varying float v_borderWidth; // Declare v_borderWidth as a uniform

uniform sampler2D u_atlas;

const float radius = 0.5;
const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  vec4 color;

  if (v_texture.w > 0.0) {
    vec4 texel = texture2D(u_atlas, v_texture.xy + gl_PointCoord * v_texture.zw, -1.0);
    color = vec4(mix(v_color, texel, texel.a).rgb, max(texel.a, v_color.a));
  } else {
    color = v_color;
  }

  vec2 m = gl_PointCoord - vec2(0.5, 0.5);
  float dist = length(m);
  float borderWidth = v_borderWidth; // Use v_borderWidth for border width
  float borderAlpha = smoothstep(radius - borderWidth, radius, dist);
  color = mix(color, v_borderColor, borderAlpha);

  if (dist < radius - borderWidth) {
  if (v_texture.w > 0.0) {
    vec4 texel = texture2D(u_atlas, v_texture.xy + gl_PointCoord * v_texture.zw, -1.0);
    color = vec4(mix(v_color, texel, texel.a).rgb, max(texel.a, v_color.a));
  } else {
    color = v_color;
  }    
    gl_FragColor = color;
  } else if (dist < radius) {
    
    gl_FragColor =  mix(transparent, v_borderColor, (radius - dist) / borderWidth);
  } else {
    gl_FragColor = transparent;
  }

}