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
import { NodeBorderProgramOptions, DEFAULT_NODE_BORDER_OPTIONS, DEFAULT_COLOR } from "./utils";

const { UNSIGNED_BYTE, FLOAT } = WebGLRenderingContext;

type NodeImageProgramOptions<N extends Attributes, E extends Attributes, G extends Attributes> = {    
  // - If "background", color will be used to color full node behind the image.
  // - If "color", color will be used to color image pixels (for pictograms)
  drawingMode: "background" | "color";
  // Allows overriding drawLabel and drawHover returned class static methods.
  drawLabel: NodeLabelDrawingFunction<N, E, G> | undefined;
  drawHover: NodeHoverDrawingFunction<N, E, G> | undefined;
  // Allows using a different color attribute name.
  colorAttribute: string;
}

const DEFAULT_NODE_IMAGE_OPTIONS: NodeImageProgramOptions<Attributes, Attributes, Attributes> = {
  drawingMode: "background",
  drawLabel: undefined,
  drawHover: undefined,
  colorAttribute: "color"  
}

export interface CreateNodeImageBorderProgramOptions<N extends Attributes, E extends Attributes, G extends Attributes>
  extends TextureManagerOptions, NodeImageProgramOptions<N, E, G>, NodeBorderProgramOptions {
}

const UNIFORMS = [
  "u_sizeRatio",
  "u_correctionRatio",
  "u_cameraAngle",
  "u_matrix",
  "u_atlas",
  "u_borderColor"
] as const;

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
    ...DEFAULT_NODE_IMAGE_OPTIONS,
    ...DEFAULT_NODE_BORDER_OPTIONS,
    ...(inputOptions || {}),
    drawHover: undefined,
    drawLabel: undefined,    
  };

  const {
    borderSize,
    borderColor,
    drawHover,
    drawLabel,    
    colorAttribute,
    ...textureManagerOptions
  } = options;

  /**
   * This texture manager is shared between all instances of this exact class,
   * returned by this call to getNodeProgramImage. This means that remounting
   * the sigma instance will not reload the images and regenerate the texture.
   */
  const textureManager = new TextureManager(textureManagerOptions);

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
          { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
          ...{
            [Symbol.iterator]: function* () {
              if (!("attribute" in borderColor)) {
                yield { name: `a_borderColor`, size: 4, type: UNSIGNED_BYTE, normalized: true };
              }
            }
          },
          ...{
            [Symbol.iterator]: function* () {
              if (!("attribute" in borderSize)) {
                yield { name: `a_borderSize`, size: 1, type: FLOAT };
              }
            }
          },
          { name: "a_texture", size: 4, type: FLOAT }          
        ],
        CONSTANT_ATTRIBUTES: [{ name: "a_angle", size: 1, type: FLOAT }],
        CONSTANT_DATA: [[NodeImageBorderProgram.ANGLE_1], [NodeImageBorderProgram.ANGLE_2], [NodeImageBorderProgram.ANGLE_3]],
      };
      console.log('res', res)
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
      const color = floatColor(data[colorAttribute as "color"]);

      const imageSource = data.image;
      const imagePosition = imageSource ? this.atlas[imageSource] : undefined;

      if (typeof imageSource === "string" && !imagePosition) textureManager.registerImage(imageSource);

      array[startIndex++] = data.x;
      array[startIndex++] = data.y;
      array[startIndex++] = data.size;
      array[startIndex++] = color;
      array[startIndex++] = nodeIndex;
      
      if ("attribute" in borderColor)
        array[startIndex++] = floatColor(data[borderColor.attribute as "borderColor"] || borderColor.defaultValue || DEFAULT_COLOR)
      else 
        array[startIndex++] = 0;
      if ("attribute" in borderSize)
        array[startIndex++] = data[borderSize.attribute as "borderSize"] || borderSize.defaultValue
      else 
        array[startIndex++] = 0;      

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
        u_cameraAngle,
      } = uniformLocations;
      this.latestRenderParams = params;

      gl.uniform1f(u_correctionRatio, params.correctionRatio);
      gl.uniform1f(u_sizeRatio, params.sizeRatio);
      gl.uniform1f(u_cameraAngle, params.cameraAngle);
      gl.uniformMatrix3fv(u_matrix, false, params.matrix);
      gl.uniform1i(u_atlas, 0);   
      if ("value" in borderColor) {
          const location = uniformLocations[`u_borderColor`];
          const [r, g, b, a] = colorToArray(borderColor.value);
          gl.uniform4f(location, r / 255, g / 255, b / 255, a / 255);
      }      
    }
  };
}
