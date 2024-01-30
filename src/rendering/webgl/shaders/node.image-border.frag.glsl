precision mediump float;
varying vec4 v_color;
varying float v_border;
varying vec4 v_texture;
varying vec4 v_borderColor; // Change v_borderColor from uniform to varying
varying float v_borderWidth; // Declare v_borderWidth as a uniform
//varying float v_opacity; // Declare v_opacity as a uniform
uniform sampler2D u_atlas;
const float radius = 0.5;
const float v_imageBorderWidth = 0.04;
const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 white = vec4(0.14, 0.16, 0.18, 1.0);
const float v_opacity = 1.0;

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
    if (dist > radius - borderWidth - v_imageBorderWidth) {
      color = mix(v_borderColor, color, (radius - dist - borderWidth) / v_imageBorderWidth);
    }    
    gl_FragColor =  mix( white, color, v_opacity );
  } else if (dist < radius) {
    gl_FragColor =  mix(transparent, v_borderColor, (radius - dist) / borderWidth);
    gl_FragColor =  mix( white, gl_FragColor, v_opacity );    
  } else {
    gl_FragColor = transparent;
  }    
}