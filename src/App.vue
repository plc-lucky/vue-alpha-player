<template>
  <div>
    <!--组件用法-->
    <AlphaPlayerWebgl
      style="width: 200px"
      ref="shaderPlayer"
      autoplay
      src="https://hw-img.wemogu.net/video/20250808/d6aff98d5e3d0b7384816f2239658e58.mp4"
      :loop="0"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    >
      <!--			<template #loading>
							<p style="font-size: 14px">视频加载中...</p>
						</template>-->
    </AlphaPlayerWebgl>

    <div style="display: flex; justify-content: center">
      <button @click="play">播放</button>
      <button @click="pause">暂停</button>
      <button @click="reset">重置</button>
    </div>
  </div>
</template>

<script setup>
import AlphaPlayerWebgl from "@/components/vue-alpha-player/vue-alpha-player.vue";
import { ref } from "vue";

const shaderPlayer = ref(null);

const play = () => {
  // 播放
  shaderPlayer.value.play();
};

const pause = () => {
  // 暂停
  shaderPlayer.value.pause();
};

const reset = () => {
  // 重置播放到初始状态
  shaderPlayer.value.reset();
};

const onPlay = () => {
  console.log("监听播放");
};

const onPause = () => {
  console.log("监听暂停");
};

const onEnded = () => {
  console.log("监听播放结束");
};
</script>

<style scoped lang="less">
button {
  font-size: 16px;
  & + button {
    margin-left: 10px;
  }
}
</style>
