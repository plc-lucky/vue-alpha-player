(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('vue')) :
  typeof define === 'function' && define.amd ? define(['vue'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.VueAlphaPlayer = factory(global.Vue));
})(this, (function (vue) { 'use strict';

  /**
   * 原生 WebGL 双通道视频播放器类
   */
  class NativeWebGLVideoPlayer {
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

  var script = {
    name: "VueAlphaPlayer",
    props: {
      src: String,
      autoplay: {
        type: Boolean,
        default: true,
      },
      // 播放次数
      loop: {
        type: Number,
        default: 0, // 0 为无限
      },
    },
    data() {
      return {
        isVideoLoaded: false, // 视频是否已加载
        isVideoPlaying: false, // 视频是否正在播放
        isPageVisible: true, // 页面是否可见
        webglPlayer: null, // WebGL 相关变量
        videoPlayCount: 1, // 播放次数
      };
    },
    computed: {
      // 如果loop为0，则无限循环
      videoLoop() {
        return this.loop === 0;
      },
    },
    methods: {
      /**
       * 视频加载完成回调
       */
      onVideoLoaded() {
        if (this.isVideoLoaded) return;
        this.isVideoLoaded = true;

        try {
          // 初始化原生WebGL播放器
          this.webglPlayer = new NativeWebGLVideoPlayer(
            this.$refs.canvasContainer,
            this.$refs.videoElement,
          );

          this.$emit("load"); // 原生WebGL场景初始化完成
          // 计算并设置响应式尺寸
          const { width, height } = this.calculateResponsiveSize();
          this.webglPlayer.resize(width, height);

          // 初始渲染一帧以显示视频的第一帧
          this.webglPlayer.render();

          if (this.autoplay) {
            this.playVideo();
          }
        } catch (error) {
          console.error("WebGL初始化失败:", error);
        }
      },

      onVideoPlay() {
        this.isVideoPlaying = true;
        // 视频开始播放时启动渲染循环
        if (this.webglPlayer && this.isPageVisible) {
          this.webglPlayer.startRenderLoop();
        }
        this.$emit("play");
      },

      onVideoPause() {
        this.isVideoPlaying = false;
        // 视频暂停时停止渲染循环
        if (this.webglPlayer) {
          this.webglPlayer.stopRenderLoop();
        }
        this.$emit("pause");
      },

      // 视频播放结束回调
      onVideoEnded() {
        this.isVideoPlaying = false;
        if (this.loop > 0 && this.videoPlayCount < this.loop) {
          this.videoPlayCount++;
          if (this.$refs.videoElement) {
            this.$refs.videoElement.play();
          }
          return;
        }
        // 视频播放结束
        this.videoPlayCount = 1;
        if (this.webglPlayer) {
          this.webglPlayer.stopRenderLoop();
        }
        this.$emit("ended");
      },

      /**
       * 视频元数据加载完成回调 (iOS兼容)
       */
      onVideoMetadataLoaded() {
        // iOS设备可能只触发这个事件，需要主动设置第一帧，触发loadeddata事件
        if (!this.$refs.videoElement || this.isVideoLoaded) return;
        // 设置视频到第一帧
        this.$refs.videoElement.currentTime = 0.1; // 稍微往后一点，避免0秒的问题
      },

      /**
       * 视频加载错误回调
       */
      onVideoError(event) {
        console.error("视频加载失败:", event);
      },

      /**
       * 计算适合容器的响应式尺寸
       */
      calculateResponsiveSize() {
        const defaultWidth = 375;
        if (!this.$refs.videoElement || !this.$refs.videoShader) {
          return { width: defaultWidth, height: defaultWidth / 2 }; // 默认尺寸
        }

        // 获取父容器(.shader_video_player_webgl)的实际宽度
        const rootWidth = this.$refs.videoShader.clientWidth || defaultWidth;

        // 获取视频的实际宽高（因为video元素display:none，不能用offsetWidth/offsetHeight）
        const originalVideoWidth = this.$refs.videoElement.videoWidth;
        const originalVideoHeight = this.$refs.videoElement.videoHeight;

        if (!originalVideoWidth || !originalVideoHeight) {
          return { width: rootWidth, height: rootWidth * 0.75 }; // 默认4:3比例
        }

        // 由于视频是左右拼接的格式（左边alpha，右边RGB），实际显示宽度是一半
        const actualWidth = originalVideoWidth / 2;

        // 计算视频的宽高比 (width/height)
        const aspectRatio = actualWidth / originalVideoHeight;

        // 以容器宽度为准，按宽高比计算对应的高度
        const finalHeight = rootWidth / aspectRatio;

        return {
          width: Math.round(rootWidth),
          height: Math.round(finalHeight),
        };
      },

      sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      },

      /**
       * 重置场景
       */
      async resetPlay() {
        if (!this.$refs.videoElement) return;

        // 停止渲染循环
        this.isVideoPlaying = false;
        if (this.webglPlayer) {
          this.webglPlayer.stopRenderLoop();
        }

        this.videoPlayCount = 1; // 重置播放次数

        // 重置视频到开始位置
        this.$refs.videoElement.currentTime = 0;
        // 等待视频重置到第一帧后再渲染
        await this.sleep(50);
        this.$refs.videoElement.pause();
        this.webglPlayer && this.webglPlayer.render(); // 确保在视频帧更新后渲染
        this.$emit("stop");
      },

      /**
       * 清理资源
       */
      cleanup() {
        // 清理WebGL资源
        if (this.webglPlayer) {
          this.webglPlayer.dispose();
          this.webglPlayer = null;
        }

        // 暂停视频
        if (this.$refs.videoElement) {
          this.$refs.videoElement.pause();
        }
      },

      playVideo() {
        if (!this.$refs.videoElement) return;
        this.$refs.videoElement.play();
      },

      pauseVideo() {
        if (!this.$refs.videoElement) return;
        this.$refs.videoElement.pause();
      },

      // 暴露给父组件的方法
      play() {
        this.playVideo();
      },

      pause() {
        this.pauseVideo();
      },

      reset() {
        this.resetPlay();
      },

      // 页面可见性处理
      handleVisibilityChange() {
        this.isPageVisible = !document.hidden;

        if (this.webglPlayer) {
          // 当页面重新可见且视频正在播放时，重启渲染循环
          if (this.isPageVisible && this.isVideoPlaying) {
            this.webglPlayer.startRenderLoop();
          } else if (!this.isPageVisible) {
            // 页面不可见时停止渲染循环以节省资源
            this.webglPlayer.stopRenderLoop();
          }
        }
      },

      // 窗口尺寸变化处理
      handleResize() {
        if (this.webglPlayer && this.isVideoLoaded) {
          const { width, height } = this.calculateResponsiveSize();
          this.webglPlayer.resize(width, height);
        }
      },
    },
    mounted() {
      // 监听页面可见性变化
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      // 监听窗口尺寸变化
      window.addEventListener("resize", this.handleResize);
    },
    beforeDestroy() {
      // 清理事件监听器
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
      window.removeEventListener("resize", this.handleResize);
      this.cleanup();
    },
  };

  const _hoisted_1 = {
    ref: "videoShader",
    class: "shader_video_player_webgl"
  };
  const _hoisted_2 = ["loop"];
  const _hoisted_3 = ["src"];
  const _hoisted_4 = {
    ref: "canvasContainer",
    class: "canvas-container"
  };
  const _hoisted_5 = {
    key: 0,
    class: "loading"
  };

  function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (vue.openBlock(), vue.createElementBlock("div", _hoisted_1, [
      vue.createCommentVNode(" 隐藏的视频元素，用作纹理源 "),
      vue.createElementVNode("video", {
        ref: "videoElement",
        class: "hidden-video",
        crossorigin: "anonymous",
        muted: "",
        loop: $options.videoLoop,
        preload: "metadata",
        playsinline: "",
        onLoadeddata: _cache[0] || (_cache[0] = (...args) => ($options.onVideoLoaded && $options.onVideoLoaded(...args))),
        onLoadedmetadata: _cache[1] || (_cache[1] = (...args) => ($options.onVideoMetadataLoaded && $options.onVideoMetadataLoaded(...args))),
        onPlay: _cache[2] || (_cache[2] = (...args) => ($options.onVideoPlay && $options.onVideoPlay(...args))),
        onPause: _cache[3] || (_cache[3] = (...args) => ($options.onVideoPause && $options.onVideoPause(...args))),
        onEnded: _cache[4] || (_cache[4] = (...args) => ($options.onVideoEnded && $options.onVideoEnded(...args))),
        onError: _cache[5] || (_cache[5] = (...args) => ($options.onVideoError && $options.onVideoError(...args)))
      }, [
        vue.createElementVNode("source", {
          src: $props.src,
          type: "video/mp4"
        }, null, 8 /* PROPS */, _hoisted_3),
        _cache[6] || (_cache[6] = vue.createTextVNode(" 您的设备不支持视频播放 ", -1 /* CACHED */))
      ], 40 /* PROPS, NEED_HYDRATION */, _hoisted_2),
      vue.createCommentVNode(" WebGL 渲染容器 "),
      vue.createElementVNode("div", _hoisted_4, [
        vue.createCommentVNode("loading"),
        (!$data.isVideoLoaded)
          ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_5, [
              vue.renderSlot(_ctx.$slots, "loading", {}, () => [
                _cache[7] || (_cache[7] = vue.createElementVNode("i", { class: "loading-spinner" }, null, -1 /* CACHED */)),
                _cache[8] || (_cache[8] = vue.createElementVNode("p", { class: "loading_text" }, "动效加载中...", -1 /* CACHED */))
              ])
            ]))
          : vue.createCommentVNode("v-if", true)
      ], 512 /* NEED_PATCH */)
    ], 512 /* NEED_PATCH */))
  }

  function styleInject(css, ref) {
    if ( ref === void 0 ) ref = {};
    var insertAt = ref.insertAt;

    if (typeof document === 'undefined') { return; }

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css_248z = ".shader_video_player_webgl .hidden-video[data-v-c051f8a2]{display:none}.shader_video_player_webgl .canvas-container .loading[data-v-c051f8a2]{align-items:center;color:rgba(0,0,0,.6);display:flex;flex-direction:column;justify-content:center}.shader_video_player_webgl .canvas-container .loading .loading-spinner[data-v-c051f8a2]{animation:spin-c051f8a2 1s linear infinite;border:4px solid rgba(0,0,0,.3);border-radius:50%;border-top-color:#000;height:40px;margin-bottom:20px;width:40px}@keyframes spin-c051f8a2{0%{transform:rotate(0deg)}to{transform:rotate(1turn)}}";
  styleInject(css_248z);

  script.render = render;
  script.__scopeId = "data-v-c051f8a2";
  script.__file = "src/components/vue-alpha-player/vue-alpha-player.vue";

  // 组件安装函数
  const install = (app) => {
    app.component("VueAlphaPlayer", script);
  };

  // 支持 Vue.use() 全局安装
  script.install = install;

  return script;

}));
