import { Attributes } from "graphology-types";
import Sigma from "sigma";
import {
  NodeHoverDrawingFunction,
  NodeLabelDrawingFunction,
  NodeProgram,
  NodeProgramType,
  ProgramInfo,
} from "sigma/rendering";
import { NodeDisplayData, RenderParams } from "sigma/types";
import { colorToArray, floatColor } from "sigma/utils";

import getFragmentShader from "./shader-frag";
import getVertexShader from "./shader-vert";
import { Atlas, DEFAULT_TEXTURE_MANAGER_OPTIONS, TextureManager, TextureManagerOptions } from "./texture";
import { CreateNodeBorderProgramOptions, DEFAULT_COLOR, DEFAULT_CREATE_NODE_BORDER_OPTIONS } from "./utils";

const { UNSIGNED_BYTE, FLOAT } = WebGLRenderingContext;

export interface CreateNodeImageBorderProgramOptions<N extends Attributes, E extends Attributes, G extends Attributes>
  extends TextureManagerOptions, CreateNodeBorderProgramOptions {
  // - If "background", color will be used to color full node behind the image.
  // - If "color", color or [colorAttribute] will be used to color image pixels (for pictograms)
  // and color will be used for background in case of transparent pictograms 
  drawingMode: "background" | "color";
  // Allows overriding drawLabel and drawHover returned class static methods.
  drawLabel: NodeLabelDrawingFunction<N, E, G> | undefined;
  drawHover: NodeHoverDrawingFunction<N, E, G> | undefined;
  // The padding should be expressed as a [0, 1] percentage.
  // A padding of 0.05 will always be 5% of the diameter of a node.
  padding: number;
  // Allows using a different color attribute name for drawingMode: color
  // as a backgrounf color attribute 'color' is used
  colorAttribute: string;
  // Transparency of the node (0-1)
  alpha: number;
}

/**
 * To share the texture between the program instances of the graph and the
 * hovered nodes (to prevent some flickering, mostly), this program must be
 * "built" for each sigma instance:
 */
export default function getNodeImageProgram<
  N extends Attributes = Attributes,
  E extends Attributes = Attributes,
  G extends Attributes = Attributes,
  >(inputOptions?: Partial<CreateNodeImageBorderProgramOptions<N, E, G>>): NodeProgramType<N, E, G> {
  
  const options: CreateNodeImageBorderProgramOptions<N, E, G> = {
    ...DEFAULT_TEXTURE_MANAGER_OPTIONS,
    ...DEFAULT_CREATE_NODE_BORDER_OPTIONS,
    drawingMode: "background",
    colorAttribute: "color",
    padding: 0,
    alpha: 1,
    ...(inputOptions || {}),
    drawHover: undefined,
    drawLabel: undefined,
  };

  const {
    border,
    drawHover,
    drawLabel,
    drawingMode,
    padding,
    alpha,
    colorAttribute,
    ...textureManagerOptions
  } = options;

  /**
   * This texture manager is shared between all instances of this exact class,
   * returned by this call to getNodeProgramImage. This means that remounting
   * the sigma instance will not reload the images and regenerate the texture.
   */
  const textureManager = new TextureManager(textureManagerOptions);

  const UNIFORMS = [
    "u_sizeRatio",
    "u_correctionRatio",
    "u_cameraAngle",
    "u_percentagePadding",
    "u_matrix",
    "u_colorizeImages",    
    "u_atlas",    
    ...(border.color && "value" in border.color ? [`u_borderColor_1`] : [])
  ] as const;

  return class NodeImageBorderProgram extends NodeProgram<(typeof UNIFORMS)[number], N, E, G> {
    static readonly ANGLE_1 = 0;
    static readonly ANGLE_2 = (2 * Math.PI) / 3;
    static readonly ANGLE_3 = (4 * Math.PI) / 3;

    static drawLabel = drawLabel;
    static drawHover = drawHover;

    getDefinition() {
      const res =  {
        VERTICES: 3,
        VERTEX_SHADER_SOURCE: getVertexShader(options),
        FRAGMENT_SHADER_SOURCE: getFragmentShader(options),
        METHOD: WebGLRenderingContext.TRIANGLES,
        UNIFORMS,
        ATTRIBUTES: [
          { name: "a_position", size: 2, type: FLOAT },
          { name: "a_size", size: 1, type: FLOAT },
          { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
          { name: "a_colorAttr", size: 4, type: UNSIGNED_BYTE, normalized: true },
          { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
          { name: "a_alpha", size: 1, type: FLOAT },
          ...(border.color && "attribute" in border.color ? [{name: `a_borderColor_1`, size: 4, type: UNSIGNED_BYTE, normalized: true }] : []),        
          ...(border.size && "attribute" in border.size ? [{name: `a_a_borderSize_1`, size: 1, type: FLOAT }] : []),     
          { name: "a_texture", size: 4, type: FLOAT }          
        ],
        CONSTANT_ATTRIBUTES: [{ name: "a_angle", size: 1, type: FLOAT }],
        CONSTANT_DATA: [[NodeImageBorderProgram.ANGLE_1], [NodeImageBorderProgram.ANGLE_2], [NodeImageBorderProgram.ANGLE_3]],
      };
      console.log('FRAGMENT_SHADER_SOURCE', res.FRAGMENT_SHADER_SOURCE)
      return res;
    }

    atlas: Atlas;
    texture: WebGLTexture;
    textureImage: ImageData;
    latestRenderParams?: RenderParams;
    textureManagerCallback: () => void;

    constructor(gl: WebGLRenderingContext, pickingBuffer: WebGLFramebuffer | null, renderer: Sigma<N, E, G>) {
      super(gl, pickingBuffer, renderer);

      this.textureManagerCallback = () => {
        if (!this) return;

        if (this.bindTexture) {
          this.atlas = textureManager.getAtlas();
          this.textureImage = textureManager.getTexture();
          this.bindTexture();
          if (this.latestRenderParams) this.render(this.latestRenderParams);
        }

        if (renderer && renderer.refresh) renderer.refresh();
      };
      textureManager.on(TextureManager.NEW_TEXTURE_EVENT, this.textureManagerCallback);

      this.atlas = textureManager.getAtlas();
      this.textureImage = textureManager.getTexture();
      this.texture = gl.createTexture() as WebGLTexture;
      this.bindTexture();
    }

    kill() {
      textureManager.off(TextureManager.NEW_TEXTURE_EVENT, this.textureManagerCallback);
    }

    bindTexture() {
      const gl = this.normalProgram.gl;

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.textureImage);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    protected renderProgram(params: RenderParams, programInfo: ProgramInfo) {
      if (!programInfo.isPicking) {
        // Rebind texture (since it's been just unbound by picking):
        const gl = programInfo.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
      }
      super.renderProgram(params, programInfo);
    }

    processVisibleItem(nodeIndex: number, startIndex: number, data: NodeDisplayData & { image?: string }): void {
      const array = this.array;
      const colorAttr = floatColor(data[colorAttribute as "color"] || DEFAULT_COLOR);
      // Even if not set explicitly, color attribute always there with #999 as a default value. Probably set by graphology
      const color = floatColor(data["color"]);
      const alpha = data["alpha"] || 1.0;

      const imageSource = data.image;
      const imagePosition = imageSource ? this.atlas[imageSource] : undefined;

      if (typeof imageSource === "string" && !imagePosition) textureManager.registerImage(imageSource);

      array[startIndex++] = data.x;
      array[startIndex++] = data.y;
      array[startIndex++] = data.size;
      array[startIndex++] = color;
      array[startIndex++] = colorAttr;
      array[startIndex++] = nodeIndex;      
      array[startIndex++] = alpha;
      if (border.color && "attribute" in border.color)
        array[startIndex++] = floatColor(data[border.color.attribute as "color"] || border.color.defaultValue || DEFAULT_COLOR);      
      if (border.size && "attribute" in border.size)
        array[startIndex++] = data[border.size.attribute as "size"] || border.size.defaultValue;
      
      // Reference texture:
      if (imagePosition) {
        const { width, height } = this.textureImage;
        array[startIndex++] = imagePosition.x / width;
        array[startIndex++] = imagePosition.y / height;
        array[startIndex++] = imagePosition.size / width;
        array[startIndex++] = imagePosition.size / height;
      } else {
        array[startIndex++] = 0;
        array[startIndex++] = 0;
        array[startIndex++] = 0;
        array[startIndex++] = 0;
      }
    }

    setUniforms(params: RenderParams, { gl, uniformLocations }: ProgramInfo): void {
      const {
        u_sizeRatio,
        u_correctionRatio,
        u_matrix,
        u_atlas,
        u_colorizeImages,        
        u_cameraAngle,
        u_percentagePadding,
      } = uniformLocations;
      this.latestRenderParams = params;

      gl.uniform1f(u_correctionRatio, params.correctionRatio);
      gl.uniform1f(u_sizeRatio, params.sizeRatio);
      gl.uniform1f(u_cameraAngle, params.cameraAngle);
      gl.uniform1f(u_percentagePadding, padding);      
      gl.uniformMatrix3fv(u_matrix, false, params.matrix);
      gl.uniform1i(u_atlas, 0);
      gl.uniform1i(u_colorizeImages, drawingMode === "color" ? 1 : 0);      
 
      if (border.color && "value" in border.color) {
          const location = uniformLocations[`u_borderColor_1`];
          const [r, g, b, a] = colorToArray(border.color.value);
          gl.uniform4f(location, r / 255, g / 255, b / 255, a / 255);
        }      
    }
  };
}
