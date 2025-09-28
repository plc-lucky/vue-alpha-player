# vue-alpha-player 组件文档

## 概述

`vue-alpha-player` 是一个基于 WebGL 的双通道透明视频播放器组件，专门用于播放包含透明通道的视频文件。该组件将视频的 RGB 数据和 Alpha 数据分别存储在视频帧的左右两部分，通过 WebGL 着色器技术实现透明视频的播放。

## 特性

-   ✅ **透明视频播放**：支持双通道透明视频格式（左侧 Alpha，右侧 RGB）
-   ✅ **WebGL 渲染**：使用原生 WebGL 实现高性能渲染
-   ✅ **响应式设计**：自动适配容器尺寸，支持窗口大小变化
-   ✅ **循环播放控制**：支持指定播放次数或无限循环
-   ✅ **自动播放**：支持自动播放和手动控制
-   ✅ **性能优化**：页面不可见时自动暂停渲染循环
-   ✅ **跨平台兼容**：兼容 iOS Safari 和其他现代浏览器
-   ✅ **加载状态**：内置加载动画和状态管理

## 原视频展示
![vue-alpha-player 原mp4](./src/assets/example.gif)

## 安装

### npm 安装

```bash
npm install vue-alpha-player
```

### yarn 安装

```bash
yarn add vue-alpha-player
```

## 使用方法

### 全局注册

```javascript
import Vue from 'vue';
import VueAlphaPlayer from 'vue-alpha-player';

Vue.use(VueAlphaPlayer);

new Vue({
  el: '#app',
  // ...
});
```

### 局部引入

```javascript
import VueAlphaPlayer from 'vue-alpha-player';

export default {
  components: {
    VueAlphaPlayer
  }
}
```

### 基础用法

```vue
<template>
	<div>
		<VueAlphaPlayer 
			ref="videoPlayerRef"
			:src="videoUrl"
			:autoplay="false"
			:loop="0"
			@play="onVideoPlay"
			@pause="onVideoPause"
			@ended="onVideoEnded"
		/>

		<div class="controls">
			<button @click="playVideo">播放</button>
			<button @click="pauseVideo">暂停</button>
			<button @click="resetVideo">重置</button>
		</div>
	</div>
</template>

<script>
import VueAlphaPlayer from 'vue-alpha-player';

export default {
	components: {
		VueAlphaPlayer
	},
	data() {
		return {
			videoUrl: 'https://example.com/alpha-video.mp4'
		};
	},
	methods: {
		playVideo() {
			if (this.$refs.videoPlayerRef) {
				this.$refs.videoPlayerRef.play();
			}
		},
		pauseVideo() {
			if (this.$refs.videoPlayerRef) {
				this.$refs.videoPlayerRef.pause();
			}
		},
		resetVideo() {
			if (this.$refs.videoPlayerRef) {
				this.$refs.videoPlayerRef.reset();
			}
		},
		onVideoPlay() {
			console.log('视频开始播放');
		},
		onVideoPause() {
			console.log('视频暂停');
		},
		onVideoEnded() {
			console.log('视频播放结束');
		}
	}
};
</script>
```

### 自定义加载中动画

```vue
<template>
	<VueAlphaPlayer :src="videoUrl">
		<template #loading>
			<div class="custom-loading">
				<div class="spinner"></div>
				<p>正在加载视频...</p>
			</div>
		</template>
	</VueAlphaPlayer>
</template>

<style scoped>
.custom-loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 20px;
}

.spinner {
	width: 40px;
	height: 40px;
	border: 4px solid #f3f3f3;
	border-top: 4px solid #3498db;
	border-radius: 50%;
	animation: spin 2s linear infinite;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}
</style>
```

## API 参考

### Props

| 参数         | 类型      | 默认值 | 说明                        |
| ------------ | --------- | ------ | --------------------------- |
| `src`        | `String`  | -      | 视频文件的 URL 地址（必需） |
| `autoplay`   | `Boolean` | `true` | 是否自动播放                |
| `loop`       | `Number`  | `0`    | 播放次数，0 表示无限循环    |

### Events

| 事件名  | 参数 | 说明                   |
| ------- | ---- | ---------------------- |
| `play`  | -    | 视频开始播放时触发     |
| `pause` | -    | 视频暂停时触发         |
| `stop`  | -    | 视频停止（重置）时触发 |
| `ended` | -    | 视频播放结束时触发     |

### 暴露的方法

| 方法名    | 参数 | 返回值          | 说明               |
| --------- | ---- | --------------- | ------------------ |
| `play()`  | -    | `void`          | 播放视频           |
| `pause()` | -    | `void`          | 暂停视频           |
| `reset()` | -    | `Promise<void>` | 重置视频到初始状态 |

### 插槽

| 插槽名    | 说明                   |
| --------- | ---------------------- |
| `loading` | 自定义加载状态显示内容 |

## 视频格式要求

该组件专门用于播放双通道透明视频，视频格式要求如下：

1. **文件格式**：MP4
2. **编码格式**：H.264
3. **通道布局**：
    - 左半部分：Alpha 通道（透明度信息）
    - 右半部分：RGB 通道（颜色信息）
4. **分辨率**：推荐使用偶数宽度，如 1920x1080、1280x720 等

## 技术实现

### WebGL 着色器

组件使用自定义的 WebGL 着色器来处理双通道视频：

```glsl
// 片段着色器核心逻辑
void main() {
    // 计算左右两部分的UV坐标
    vec2 leftUv = vec2(v_texCoord.x * 0.5, v_texCoord.y);           // Alpha通道
    vec2 rightUv = vec2(0.5 + v_texCoord.x * 0.5, v_texCoord.y);   // RGB通道

    // 采样颜色和透明度数据
    vec4 colorData = texture2D(u_texture, rightUv);  // RGB数据
    float alphaData = texture2D(u_texture, leftUv).r; // Alpha数据

    gl_FragColor = vec4(colorData.rgb, alphaData);
}
```

### 性能优化

-   **智能渲染循环**：仅在视频播放且页面可见时启动渲染循环
-   **资源管理**：组件销毁时自动清理 WebGL 资源
-   **响应式尺寸**：根据容器自动计算最佳显示尺寸
-   **设备像素比优化**：支持高 DPI 屏幕，最大限制为 2x 以平衡性能

## 浏览器兼容性

| 浏览器  | 版本要求 | 说明                      |
| ------- | -------- | ------------------------- |
| Chrome  | 56+      | 完全支持                  |
| Firefox | 51+      | 完全支持                  |
| Safari  | 10+      | 完全支持，包括 iOS Safari |
| Edge    | 79+      | 完全支持                  |