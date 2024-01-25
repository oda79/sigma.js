precision mediump float;

varying vec4 v_color;
varying float v_border;
varying vec4 v_texture;
varying vec4 v_borderColor;
varying float v_borderWidth;

uniform sampler2D u_atlas;

const float bias = 255.0 / 254.0;

void main(void) {
  vec4 color;

  if (v_texture.w > 0.0) {
    vec4 texel = texture2D(u_atlas, v_texture.xy + gl_PointCoord * v_texture.zw, -1.0);
    color = vec4(mix(v_color, texel, texel.a).rgb, max(texel.a, v_color.a));
  } else {
    color = v_color;
  }

  vec2 m = gl_PointCoord - vec2(0.5, 0.5);
  float dist = length(m); // Distance from fragment to point center
  float borderWidth = v_borderWidth; // Border width

  // Calculate the border alpha based on the distance from the center of the point
  // to the fragment coordinates using the Pythagorean theorem
  float borderAlpha = smoothstep(radius - borderWidth, radius, dist);

  // Mix the color with the border color based on the border alpha
  color = mix(color, v_borderColor, borderAlpha);

  // Determine if the fragment is inside or outside the border
  if (dist < 0.5 - borderWidth) { // Assuming the radius of the point is 0.5
    gl_FragColor = color;
  } else {
    // Mix the color with transparent if outside the border
    gl_FragColor = mix(vec4(0.0), color, borderAlpha);
  }
}