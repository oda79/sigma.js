/**
 * Sigma.js WebGL Renderer Node Program
 * =====================================
 *
 * Program rendering nodes using GL_POINTS, but that draws an image on top of
 * the classic colored disc.
 * @module
 */
import { Coordinates, Dimensions, NodeDisplayData } from "../../../types";
import { floatColor } from "../../../utils";
import vertexShaderSource from "../shaders/node.image.vert.glsl";
import fragmentShaderSource from "../shaders/node.image.frag.glsl";
import { AbstractNodeProgram } from "./common/node";
import { RenderParams } from "./common/program";
import Sigma from "../../../sigma";

const POINTS = 1,
  ATTRIBUTES = 8,
  // maximum size of single texture in atlas
  MAX_TEXTURE_SIZE = 192,
  // maximum width of atlas texture (limited by browser)
  // low setting of 3072 works on phones & tablets
  MAX_CANVAS_WIDTH = 3072;

type ImageLoading = { status: "loading" };
type ImageError = { status: "error" };
type ImagePending = { status: "pending"; image: HTMLImageElement };
type ImageReady = { status: "ready" } & Coordinates & Dimensions;
type ImageType = ImageLoading | ImageError | ImagePending | ImageReady;

// This class only exists for the return typing of `getNodeImageProgram`:
class AbstractNodeImageProgram extends AbstractNodeProgram {
  /* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */
  constructor(gl: WebGLRenderingContext, renderer: Sigma) {
    super(gl, vertexShaderSource, fragmentShaderSource, POINTS, ATTRIBUTES);
  }
  bind(): void {}
  process(data: NodeDisplayData & { image?: string }, hidden: boolean, offset: number): void {}
  render(params: RenderParams): void {}
  rebindTexture() {}
  /* eslint-enable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */
}

/**
 * To share the texture between the program instances of the graph and the
 * hovered nodes (to prevent some flickering, mostly), this program must be
 * "built" for each sigma instance:
 */
export default function getNodeImageProgram(): typeof AbstractNodeImageProgram {
  /**
   * These attributes are shared between all instances of this exact class,
   * returned by this call to getNodeProgramImage:
   */
  const rebindTextureFns: (() => void)[] = [];
  const images: Record<string, ImageType> = {};
  let textureImage: ImageData;
  let hasReceivedImages = false;
  let pendingImagesFrameID: number | undefined = undefined;

  // next write position in texture
  let writePositionX = 0;
  let writePositionY = 0;
  // height of current row
  let writeRowHeight = 0;

  interface PendingImage {
    image: any;
    id: string;
    size: number;
  }
  function getImageIndex(data: any) {
    return data.image + (data.borderColor && data.borderWidth ? `${data.borderColor}${data.borderWidth}` : "");
  }
  /**
   * Helper to load an image:
   */
  function loadImage(imageSource: string, nodeData: NodeDisplayData): void {
    if (images[getImageIndex(nodeData)]) return;

    const image = new Image();
    image.addEventListener("load", () => {
      images[getImageIndex(nodeData)] = {
        status: "pending",
        image,
      };

      if (typeof pendingImagesFrameID !== "number") {
        pendingImagesFrameID = requestAnimationFrame(() => finalizePendingImages());
      }
    });
    image.addEventListener("error", () => {
      images[getImageIndex(nodeData)] = { status: "error" };
    });
    images[getImageIndex(nodeData)] = { status: "loading" };

    // Load image:
    image.setAttribute("crossOrigin", "");
    image.src = imageSource;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (image as any).nodeData = nodeData;
  }

  /**
   * Helper that takes all pending images and adds them into the texture:
   */
  function finalizePendingImages(): void {
    pendingImagesFrameID = undefined;

    const pendingImages: PendingImage[] = [];

    // List all pending images:
    for (const id in images) {
      const state = images[id];
      if (state.status === "pending") {
        pendingImages.push({
          id,
          image: state.image,
          size: Math.min(state.image.width, state.image.height) || 1,
        });
      }
    }

    // Add images to texture:
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

    // limit canvas size to avoid browser and platform limits
    let totalWidth = hasReceivedImages ? textureImage.width : 0;
    let totalHeight = hasReceivedImages ? textureImage.height : 0;

    // initialize image drawing offsets with current write position
    let xOffset = writePositionX;
    let yOffset = writePositionY;

    /**
     * Draws a (full or partial) row of images into the atlas texture
     * @param pendingImages
     */
    const drawRow = (pendingImages: PendingImage[]) => {
      // update canvas size before drawing
      if (canvas.width !== totalWidth || canvas.height !== totalHeight) {
        canvas.width = Math.min(MAX_CANVAS_WIDTH, totalWidth);
        canvas.height = totalHeight;

        // draw previous texture into resized canvas
        if (hasReceivedImages) {
          ctx.putImageData(textureImage, 0, 0);
        }
      }

      pendingImages.forEach(({ id, image, size }) => {
        const imageSizeInTexture = Math.min(MAX_TEXTURE_SIZE, size);

        // Crop image, to only keep the biggest square, centered:
        let dx = 0,
          dy = 0;
        if ((image.width || 0) > (image.height || 0)) {
          dx = (image.width - image.height) / 2;
        } else {
          dy = (image.height - image.width) / 2;
        }
        ctx.drawImage(image, dx, dy, size, size, xOffset, yOffset, imageSizeInTexture, imageSizeInTexture);
        if (image.nodeData && image.nodeData.borderColor && image.nodeData.borderWidth) {
          ctx.beginPath();
          ctx.lineWidth = ((imageSizeInTexture / image.nodeData.size) * image.nodeData.borderWidth) / 2;
          ctx.arc(
            xOffset + imageSizeInTexture / 2,
            yOffset + imageSizeInTexture / 2,
            imageSizeInTexture / 2 - ctx.lineWidth / 2,
            0,
            2 * Math.PI,
          );
          ctx.strokeStyle = image.nodeData.borderColor;
          ctx.stroke();
        }

        // Update image state:
        images[id] = {
          status: "ready",
          x: xOffset,
          y: yOffset,
          width: imageSizeInTexture,
          height: imageSizeInTexture,
        };

        xOffset += imageSizeInTexture;
      });

      hasReceivedImages = true;
      textureImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    let rowImages: PendingImage[] = [];
    pendingImages.forEach((image) => {
      const { size } = image;
      const imageSizeInTexture = Math.min(size, MAX_TEXTURE_SIZE);

      if (writePositionX + imageSizeInTexture > MAX_CANVAS_WIDTH) {
        // existing row is full: flush row and continue on next line
        if (rowImages.length > 0) {
          totalWidth = Math.max(writePositionX, totalWidth);
          totalHeight = Math.max(writePositionY + writeRowHeight, totalHeight);
          drawRow(rowImages);

          rowImages = [];
          writeRowHeight = 0;
        }

        writePositionX = 0;
        writePositionY = totalHeight;
        xOffset = 0;
        yOffset = totalHeight;
      }

      // add image to row
      rowImages.push(image);

      // advance write position and update maximum row height
      writePositionX += imageSizeInTexture;
      writeRowHeight = Math.max(writeRowHeight, imageSizeInTexture);
    });

    // flush pending images in row - keep write position (and drawing cursor)
    totalWidth = Math.max(writePositionX, totalWidth);
    totalHeight = Math.max(writePositionY + writeRowHeight, totalHeight);
    drawRow(rowImages);
    rowImages = [];

    rebindTextureFns.forEach((fn) => fn());
  }

  return class NodeImageProgram extends AbstractNodeProgram {
    texture: WebGLTexture;
    textureLocation: GLint;
    atlasLocation: WebGLUniformLocation;
    latestRenderParams?: RenderParams;

    constructor(gl: WebGLRenderingContext, renderer: Sigma) {
      super(gl, vertexShaderSource, fragmentShaderSource, POINTS, ATTRIBUTES);

      rebindTextureFns.push(() => {
        if (this && this.rebindTexture) this.rebindTexture();
        if (renderer && renderer.refresh) renderer.refresh();
      });

      textureImage = new ImageData(1, 1);

      // Attribute Location
      this.textureLocation = gl.getAttribLocation(this.program, "a_texture");

      // Uniform Location
      const atlasLocation = gl.getUniformLocation(this.program, "u_atlas");
      if (atlasLocation === null) throw new Error("NodeProgramImage: error while getting atlasLocation");
      this.atlasLocation = atlasLocation;

      // Initialize WebGL texture:
      this.texture = gl.createTexture() as WebGLTexture;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

      this.bind();
    }

    bind(): void {
      super.bind();

      const gl = this.gl;

      gl.enableVertexAttribArray(this.textureLocation);
      gl.vertexAttribPointer(
        this.textureLocation,
        4,
        gl.FLOAT,
        false,
        this.attributes * Float32Array.BYTES_PER_ELEMENT,
        16,
      );
    }

    process(data: NodeDisplayData & { image?: string }, hidden: boolean, offset: number): void {
      const array = this.array;
      let i = offset * POINTS * ATTRIBUTES;

      const imageSource = data.image;
      const imageState = imageSource && images[getImageIndex(data)];
      if (typeof imageSource === "string" && !imageState) loadImage(imageSource, data);

      if (hidden) {
        array[i++] = 0;
        array[i++] = 0;
        array[i++] = 0;
        array[i++] = 0;
        // Texture:
        array[i++] = 0;
        array[i++] = 0;
        array[i++] = 0;
        array[i++] = 0;
        return;
      }

      array[i++] = data.x;
      array[i++] = data.y;
      array[i++] = data.size;
      array[i++] = floatColor(data.color);

      // Reference texture:
      if (imageState && imageState.status === "ready") {
        const { width, height } = textureImage;
        array[i++] = imageState.x / width;
        array[i++] = imageState.y / height;
        array[i++] = imageState.width / width;
        array[i++] = imageState.height / height;
      } else {
        array[i++] = 0;
        array[i++] = 0;
        array[i++] = 0;
        array[i++] = 0;
      }
    }

    render(params: RenderParams): void {
      if (this.hasNothingToRender()) return;

      this.latestRenderParams = params;

      const gl = this.gl;

      const program = this.program;
      gl.useProgram(program);

      gl.uniform1f(this.ratioLocation, 1 / Math.sqrt(params.ratio));
      gl.uniform1f(this.scaleLocation, params.scalingRatio);
      gl.uniformMatrix3fv(this.matrixLocation, false, params.matrix);
      gl.uniform1i(this.atlasLocation, 0);

      gl.drawArrays(gl.POINTS, 0, this.array.length / ATTRIBUTES);
    }

    rebindTexture() {
      const gl = this.gl;

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
      gl.generateMipmap(gl.TEXTURE_2D);

      if (this.latestRenderParams) {
        this.bind();
        this.bufferData();
        this.render(this.latestRenderParams);
      }
    }
  };
}