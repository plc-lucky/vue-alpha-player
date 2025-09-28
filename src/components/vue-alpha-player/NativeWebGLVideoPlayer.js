/**
 * 原生 WebGL 双通道视频播放器类
 */
export class NativeWebGLVideoPlayer {
  constructor(container, videoElement) {
    this.container = container;
    this.video = videoElement;
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.animationId = null;
    this.isRendering = false;

    this.init();
  }

  init() {
    try {
      // 创建Canvas
      this.canvas = document.createElement("canvas");
      this.container.appendChild(this.canvas);

      // 获取WebGL上下文
      this.gl =
        this.canvas.getContext("webgl", {
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: false,
        }) || this.canvas.getContext("experimental-webgl");

      this.setupShaders();
      this.setupGeometry();
      this.setupTexture();
    } catch (error) {
      console.error("WebGL初始化失败:", error);
      throw error;
    }
  }

  // 设置着色器程序
  setupShaders() {
    const vertexShaderSource = `
			attribute vec2 a_position;
			attribute vec2 a_texCoord;
			varying vec2 v_texCoord;
			
			void main() {
				gl_Position = vec4(a_position, 0.0, 1.0);
				v_texCoord = a_texCoord;
			}
		`;

    const fragmentShaderSource = `
			#ifdef GL_ES
			precision mediump float;
			#endif
			
			uniform sampler2D u_texture;
			varying vec2 v_texCoord;
			
			void main() {
				// 优化的纹理采样：预计算UV坐标
				vec2 leftUv = vec2(v_texCoord.x * 0.5, v_texCoord.y);           // 左半部分（Alpha）
				vec2 rightUv = vec2(0.5 + v_texCoord.x * 0.5, v_texCoord.y);   // 右半部分（RGB）
				
				// 单次采样获取颜色和透明度数据
				vec4 colorData = texture2D(u_texture, rightUv);  // RGB数据
				float alphaData = texture2D(u_texture, leftUv).r; // Alpha数据
				
				gl_FragColor = vec4(colorData.rgb, alphaData);
			}
		`;

    const vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    this.program = this.createProgram(vertexShader, fragmentShader);
    this.gl.useProgram(this.program);

    // 清理着色器对象
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
  }

  // 创建着色器
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`着色器编译错误: ${error}`);
    }

    return shader;
  }

  // 创建程序
  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`程序链接错误: ${error}`);
    }

    return program;
  }

  // 设置几何体
  setupGeometry() {
    // 创建矩形顶点 (两个三角形组成矩形)
    const scale = 1; // 缩放
    const positions = [
      -scale,
      -scale,
      scale,
      -scale,
      -scale,
      scale, // 第一个三角形
      -scale,
      scale,
      scale,
      -scale,
      scale,
      scale, // 第二个三角形
    ];

    const texCoords = [
      0,
      1,
      1,
      1,
      0,
      0, // 第一个三角形的纹理坐标
      0,
      0,
      1,
      1,
      1,
      0, // 第二个三角形的纹理坐标
    ];

    // 位置缓冲区
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(positions),
      this.gl.STATIC_DRAW,
    );

    const positionLocation = this.gl.getAttribLocation(
      this.program,
      "a_position",
    );
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );

    // 纹理坐标缓冲区
    const texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(texCoords),
      this.gl.STATIC_DRAW,
    );

    const texCoordLocation = this.gl.getAttribLocation(
      this.program,
      "a_texCoord",
    );
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(
      texCoordLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );

    // 存储缓冲区引用以便后续清理
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
  }

  // 设置纹理
  setupTexture() {
    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    // 设置纹理参数
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR,
    );

    // 绑定纹理到纹理单元0
    const textureLocation = this.gl.getUniformLocation(
      this.program,
      "u_texture",
    );
    this.gl.uniform1i(textureLocation, 0);
  }

  // 渲染函数
  render() {
    if (!this.gl || !this.program || !this.video) return;

    // 检查视频是否有有效的数据
    if (
      this.video.readyState < 2 ||
      this.video.videoWidth === 0 ||
      this.video.videoHeight === 0
    ) {
      return; // 视频数据还不可用，跳过渲染
    }

    try {
      // 更新视频纹理
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        this.video,
      );

      // 设置视口
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      // 清除画布
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      // 启用混合
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

      // 绘制
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    } catch (error) {
      console.warn("WebGL渲染出错:", error);
    }
  }

  // 开始渲染循环
  startRenderLoop() {
    if (this.isRendering) return;
    this.isRendering = true;

    const loop = () => {
      if (this.isRendering) {
        this.render();
        this.animationId = requestAnimationFrame(loop);
      }
    };
    loop();
  }

  // 停止渲染循环
  stopRenderLoop() {
    this.isRendering = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // 调整画布尺寸
  resize(width, height) {
    if (!this.canvas) return;

    // 设置画布的实际像素尺寸
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = width * pixelRatio;
    this.canvas.height = height * pixelRatio;

    // 设置画布的显示尺寸
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    // 渲染一帧以更新显示
    if (!this.isRendering) {
      this.render();
    }
  }

  // 清理资源
  dispose() {
    this.stopRenderLoop();

    if (this.gl) {
      // 清理缓冲区
      if (this.positionBuffer) {
        this.gl.deleteBuffer(this.positionBuffer);
      }
      if (this.texCoordBuffer) {
        this.gl.deleteBuffer(this.texCoordBuffer);
      }

      // 清理纹理
      if (this.texture) {
        this.gl.deleteTexture(this.texture);
      }

      // 清理程序
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
    }

    // 移除canvas元素
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // 清理引用
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.positionBuffer = null;
    this.texCoordBuffer = null;
  }
}
