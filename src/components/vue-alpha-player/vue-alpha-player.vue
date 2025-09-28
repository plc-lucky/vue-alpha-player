<template>
  <div ref="videoShader" class="shader_video_player_webgl">
    <!-- 隐藏的视频元素，用作纹理源 -->
    <video
      ref="videoElement"
      class="hidden-video"
      crossorigin="anonymous"
      muted
      :loop="videoLoop"
      preload="metadata"
      playsinline
      @loadeddata="onVideoLoaded"
      @loadedmetadata="onVideoMetadataLoaded"
      @play="onVideoPlay"
      @pause="onVideoPause"
      @ended="onVideoEnded"
      @error="onVideoError"
    >
      <source :src="src" type="video/mp4" />
      您的设备不支持视频播放
    </video>

    <!-- WebGL 渲染容器 -->
    <div ref="canvasContainer" class="canvas-container">
      <!--loading-->
      <div v-if="!isVideoLoaded" class="loading">
        <slot name="loading">
          <i class="loading-spinner"></i>
          <p class="loading_text">动效加载中...</p>
        </slot>
      </div>
    </div>
  </div>
</template>

<script>
import { NativeWebGLVideoPlayer } from "./NativeWebGLVideoPlayer.js";

export default {
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
</script>

<style scoped lang="less">
.shader_video_player_webgl {
  .hidden-video {
    display: none;
  }

  .canvas-container {
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(0, 0, 0, 0.6);
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(0, 0, 0, 0.3);
        border-top: 4px solid #000000;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    }
  }
}
</style>
