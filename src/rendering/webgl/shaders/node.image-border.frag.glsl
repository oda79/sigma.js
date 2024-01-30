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
  vec4 color;
  if (v_texture.w > 0.0) {
    vec4 texel = texture2D(u_atlas, v_texture.xy + gl_PointCoord * v_texture.zw, -1.0);
    color = vec4(mix(v_color, texel, texel.a).rgb, max(texel.a, v_color.a));
  } else {
    color = v_color;
  }
  vec2 m = gl_PointCoord - vec2(0.5, 0.5);
  float dist = length(m);
  if (dist < radius - v_border) {
    // Draw texture
    if (v_texture.w > 0.0) {
      vec4 texel = texture2D(u_atlas, v_texture.xy + gl_PointCoord * v_texture.zw, -1.0);
      color = vec4(mix(v_color, texel, texel.a).rgb, max(texel.a, v_color.a));
    } else {
      color = v_color;
    }
    // Make a border between texture and border smooth
    if (dist > radius - v_border - v_imageBorderWidth) {
      color = mix(v_borderColor, color, (radius - dist - v_border) / v_imageBorderWidth);
    }    
    // Add overall opacity if any 
    gl_FragColor =  mix( blur, color, v_opacity );
  } else if (dist < radius) {
    // Draw border
    gl_FragColor =  mix( blur, mix(transparent, v_borderColor, (radius - dist) / v_border), v_opacity) ;    
  } else {
    // Draw anything out of the border
    gl_FragColor = transparent;
  }    
}