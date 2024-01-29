attribute vec2 a_position;
attribute float a_size;
attribute vec4 a_color;
attribute vec4 a_borderColor;
attribute float a_opacity;
attribute vec4 a_texture;

uniform float u_ratio;
uniform float u_scale;
uniform mat3 u_matrix;

varying vec4 v_color;
varying float v_border;
varying vec4 v_texture;
varying vec4 v_borderColor; // Change v_borderColor from varying to uniform
varying float v_opacity; // Change v_borderWidth from varying to uniform

const float bias = 255.0 / 254.0;

void main() {
  gl_Position = vec4(
    (u_matrix * vec3(a_position, 1)).xy,
    0,
    1
  );

  gl_PointSize = a_size * u_ratio * u_scale * 2.0;

  v_border = (1.0 / u_ratio) * (0.5 / a_size);

  v_color = a_color;
  v_color.a *= bias;

  v_texture = a_texture;

  // Assign the uniform border color
  v_borderColor = a_borderColor;
  v_opacity = a_opacity;
}
